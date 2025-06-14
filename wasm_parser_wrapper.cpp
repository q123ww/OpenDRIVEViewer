#include <string>
#include <sstream>
#include <vector>
#include <iterator>
#include <emscripten/bind.h>
#include "pugixml.hpp" // libOpenDRIVE-main/pugixml 포함 경로
#include "OpenDriveMap.h" // libOpenDRIVE 메인 헤더
#include "nlohmann/json.hpp" // single-header JSON 라이브러리
#include <fstream>
#include <atomic>
#include "Geometries/Arc.h"
#include "Geometries/Spiral.h"
#include "Geometries/ParamPoly3.h"

// 아주 간단한 XML → JSON 직렬화:
// { "roads": [ {"id":"1", "length":123.4}, ... ] }
// 후속 단계에서 nlohmann::json 사용 및 상세 객체 구조 추가 예정.

#ifndef MAX_CENTER_SAMPLES
#define MAX_CENTER_SAMPLES 1000
#endif

static std::string escape_json(const std::string& s)
{
    std::ostringstream o;
    for (auto c : s)
    {
        switch (c)
        {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if (' ' <= c && c <= '~') o << c;
                else o << "\\u" + std::string(4 - std::to_string((int)c).length(), '0') + std::to_string((int)c);
        }
    }
    return o.str();
}

std::string parseXodr(const std::string& xodrContent)
{
    // 1) 메모리 파일로 저장 (MEMFS)
    static std::atomic<int> file_counter{0};
    const int              idx = file_counter.fetch_add(1);
    const std::string      tmp_filename = "/tmp/xodr_" + std::to_string(idx) + ".xodr";

    // MEMFS 에쓰기
    {
        std::ofstream ofs(tmp_filename, std::ios::binary);
        if (!ofs)
        {
            return std::string("{\"error\":\"Failed to open tmp file\"}");
        }
        ofs.write(xodrContent.data(), static_cast<std::streamsize>(xodrContent.size()));
    }

    // 2) OpenDriveMap 로드
    odr::OpenDriveMap map(tmp_filename,
                          /*center_map*/ false,
                          /*with_road_objects*/ false,
                          /*with_lateral_profile*/ true,
                          /*with_lane_height*/ false,
                          /*abs_z_for_local_road_obj_outline*/ false,
                          /*fix_spiral_edge_cases*/ true,
                          /*with_road_signals*/ false);

    // 3) nlohmann::json 직렬화
    nlohmann::json root_j;
    root_j["roads"] = nlohmann::json::array();

    for (const auto& road_pair : map.id_to_road)
    {
        const odr::Road& road = road_pair.second;
        nlohmann::json    jroad;
        jroad["id"] = road.id;
        jroad["length"] = road.length;

        // Add junction info for debugging
        if (road.junction != "-1") {
            jroad["junction_id"] = road.junction;
        }

        try {
            // Calculate reference line vertices with a 0.5m step
            nlohmann::json centerline_json = nlohmann::json::array();
            const double step = 0.5;
            for (double s = 0.0; s <= road.length; s += step) {
                odr::Vec3D point = road.ref_line.get_xyz(s);
                centerline_json.push_back({
                    {"x", point[0]},
                    {"y", point[1]},
                    {"z", point[2]}
                });
            }

            if (centerline_json.empty()) {
                jroad["parsing_status"] = "warning";
                jroad["error_message"] = "Failed to generate centerline points.";
                jroad["centerline"] = nlohmann::json::array();
            } else {
                jroad["centerline"] = centerline_json;
                jroad["parsing_status"] = "success";
            }
        } catch (const std::exception& e) {
            // Catch any exceptions during geometry calculation
            jroad["parsing_status"] = "failed";
            jroad["error_message"] = e.what();
            jroad["centerline"] = nlohmann::json::array(); // Ensure centerline is always present
        }

        // planView
        nlohmann::json jPlan;
        jPlan["geometries"] = nlohmann::json::array();
        for (const auto& geom_pair : road.ref_line.s0_to_geometry)
        {
            const odr::RoadGeometry* geom = geom_pair.second.get();
            nlohmann::json           jGeom;
            jGeom["s"] = geom->s0;
            jGeom["x"] = geom->x0;
            jGeom["y"] = geom->y0;
            jGeom["hdg"] = geom->hdg0;
            jGeom["length"] = geom->length;

            switch (geom->type)
            {
            case odr::GeometryType_Line:
                jGeom["type"] = "line";
                jGeom["params"] = nlohmann::json::object();
                break;
            case odr::GeometryType_Arc:
            {
                jGeom["type"] = "arc";
                const odr::Arc* arc = dynamic_cast<const odr::Arc*>(geom);
                if (arc)
                    jGeom["params"] = { {"curvature", arc->curvature} };
                break;
            }
            case odr::GeometryType_Spiral:
            {
                jGeom["type"] = "spiral";
                const odr::Spiral* sp = dynamic_cast<const odr::Spiral*>(geom);
                if (sp)
                    jGeom["params"] = { {"curvStart", sp->curv_start}, {"curvEnd", sp->curv_end} };
                break;
            }
            case odr::GeometryType_ParamPoly3:
            {
                jGeom["type"] = "paramPoly3";
                const odr::ParamPoly3* pp = dynamic_cast<const odr::ParamPoly3*>(geom);
                if (pp)
                {
                    jGeom["params"] = {
                        {"aU", pp->aU}, {"bU", pp->bU}, {"cU", pp->cU}, {"dU", pp->dU},
                        {"aV", pp->aV}, {"bV", pp->bV}, {"cV", pp->cV}, {"dV", pp->dV},
                        {"pRangeNormal", pp->pRange_normalized}
                    };
                }
                break;
            }
            default:
                jGeom["type"] = "unknown";
                jGeom["params"] = nlohmann::json::object();
                break;
            }
            jPlan["geometries"].push_back(jGeom);
        }
        jroad["planView"] = jPlan;

        // laneSections
        jroad["laneSections"] = nlohmann::json::array();
        for (auto ls_it = road.s_to_lanesection.begin(); ls_it != road.s_to_lanesection.end(); ++ls_it)
        {
            const odr::LaneSection& ls = ls_it->second;
            nlohmann::json jls;
            jls["s"] = ls.s0;

            constexpr double EPS = 1e-4; // 여유 버퍼 확대
            double ls_length = 0.0;
            auto next_it = std::next(ls_it);
            if (next_it != road.s_to_lanesection.end())
                ls_length = next_it->first - ls.s0;
            else
                ls_length = road.length - ls.s0;

            // 부정확한 데이터로 길이가 0 이하인 섹션은 건너뜀
            if (ls_length <= EPS)
                continue;

            jls["length"] = ls_length;
            jls["lanes"] = nlohmann::json::array();

            for (const auto& id_lane_pair : ls.id_to_lane)
            {
                const odr::Lane& lane = id_lane_pair.second;
                if (lane.id == 0) // reference line already represents center
                    continue;
                nlohmann::json jlane;
                jlane["id"] = lane.id;
                jlane["type"] = lane.type;

                // centerline 샘플 개수를 제한하여 메모리 사용을 줄임
                double interval = 2.0;
                const double s_start = ls.s0;
                const double s_end   = std::min(ls.s0 + ls_length, road.length - EPS);
                if (s_end <= s_start) // 비정상 범위 방지
                    continue;
                jlane["centerline"] = nlohmann::json::array();

                for (double s = s_start; s <= s_end; s += interval)
                {
                    double s_clamped = s; // already clamped
                    // compute center offset approximately: accumulate lane widths from LaneSection data
                    double center_off = 0.0; // TODO precise compute
                    odr::Vec3D ref_pt = road.ref_line.get_xyz(s_clamped);
                    odr::Vec3D grad   = road.ref_line.get_grad(s_clamped);
                    // normal vector
                    double nx = -grad[1];
                    double ny = grad[0];
                    double norm = std::sqrt(nx*nx + ny*ny);
                    if (norm < 1e-9) norm = 1;
                    nx /= norm; ny /= norm;
                    nlohmann::json jpt;
                    jpt["x"] = ref_pt[0] + nx * center_off;
                    jpt["y"] = ref_pt[1] + ny * center_off;
                    jpt["z"] = ref_pt[2];
                    jlane["centerline"].push_back(jpt);
                }

                jls["lanes"].push_back(jlane);
            }

            jroad["laneSections"].push_back(jls);
        }

        // laneOffset
        jroad["laneOffset"] = nlohmann::json::array();
        for (const auto& lo_pair : road.lane_offset.s0_to_poly)
        {
            const double sOffset = lo_pair.first;
            const odr::Poly3& poly = lo_pair.second;
            nlohmann::json jLO;
            jLO["s"] = sOffset;
            jLO["a"] = poly.a;
            jLO["b"] = poly.b;
            jLO["c"] = poly.c;
            jLO["d"] = poly.d;
            jroad["laneOffset"].push_back(jLO);
        }

        root_j["roads"].push_back(jroad);
    }

    return root_j.dump();
}

EMSCRIPTEN_BINDINGS(OpenDriveWasmModule)
{
    emscripten::function("parseXodr", &parseXodr);
} 