#include <string>
#include <sstream>
#include <vector>
#include <emscripten/bind.h>
#include "pugixml.hpp" // libOpenDRIVE-main/pugixml 포함 경로

// 아주 간단한 XML → JSON 직렬화:
// { "roads": [ {"id":"1", "length":123.4}, ... ] }
// 후속 단계에서 nlohmann::json 사용 및 상세 객체 구조 추가 예정.

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
    pugi::xml_document doc;
    pugi::xml_parse_result res = doc.load_buffer(xodrContent.c_str(), xodrContent.size());
    if (!res)
    {
        return std::string("{\"error\": \"XML parse error: ") + escape_json(res.description()) + "\"}";
    }

    pugi::xml_node odr = doc.child("OpenDRIVE");
    if (!odr)
    {
        return "{\"error\":\"Invalid OpenDRIVE: missing root\"}";
    }

    std::ostringstream json;
    json << "{\"roads\":[";
    bool first = true;
    for (pugi::xml_node road : odr.children("road"))
    {
        if (!first) json << ",";
        first = false;
        const char* id = road.attribute("id").value();
        double length = road.attribute("length").as_double(0.0);
        json << "{\"id\":\"" << escape_json(id) << "\",\"length\":" << length;

        // planView geometries
        pugi::xml_node planView = road.child("planView");
        json << ",\"planView\":{\"geometries\":[";
        bool firstGeom = true;
        if (planView)
        {
            for (pugi::xml_node geom : planView.children("geometry"))
            {
                if (!firstGeom) json << ",";
                firstGeom = false;
                double sVal = geom.attribute("s").as_double(0.0);
                double xVal = geom.attribute("x").as_double(0.0);
                double yVal = geom.attribute("y").as_double(0.0);
                double hdgVal = geom.attribute("hdg").as_double(0.0);
                double lenVal = geom.attribute("length").as_double(0.0);

                const char* geomType = "unknown";
                std::ostringstream params;
                params << "{}";

                if (geom.child("line")) {
                    geomType = "line";
                } else if (geom.child("arc")) {
                    geomType = "arc";
                    double curvature = geom.child("arc").attribute("curvature").as_double(0.0);
                    params.str(""); params.clear();
                    params << "{\"curvature\":" << curvature << "}";
                } else if (geom.child("spiral")) {
                    geomType = "spiral";
                    double curvStart = geom.child("spiral").attribute("curvStart").as_double(0.0);
                    double curvEnd = geom.child("spiral").attribute("curvEnd").as_double(0.0);
                    params.str(""); params.clear();
                    params << "{\"curvStart\":" << curvStart << ",\"curvEnd\":" << curvEnd << "}";
                } else if (geom.child("poly3")) {
                    geomType = "poly3";
                    double a = geom.child("poly3").attribute("a").as_double(0.0);
                    double b = geom.child("poly3").attribute("b").as_double(0.0);
                    double c = geom.child("poly3").attribute("c").as_double(0.0);
                    double d = geom.child("poly3").attribute("d").as_double(0.0);
                    params.str(""); params.clear();
                    params << "{\"a\":" << a << ",\"b\":" << b << ",\"c\":" << c << ",\"d\":" << d << "}";
                }

                json << "{\"s\":" << sVal
                     << ",\"x\":" << xVal
                     << ",\"y\":" << yVal
                     << ",\"hdg\":" << hdgVal
                     << ",\"length\":" << lenVal
                     << ",\"type\":\"" << geomType << "\",\"params\":" << params.str() << "}";
            }
        }
        json << "]}"; // close geometries and planView

        // laneSections with detailed width segments
        json << ",\"laneSections\":[";
        bool firstLS=true;
        for(pugi::xml_node ls : road.child("lanes").children("laneSection")){
            if(!firstLS) json << ",";
            firstLS=false;
            double ls_s = ls.attribute("s").as_double();
            json << "{\"s\":"<<ls_s<<",\"lanes\":[";
            bool firstLane=true;
            for(pugi::xml_node side : ls.children()){
                std::string sname = side.name();
                if(sname=="left"||sname=="right"||sname=="center"){
                    for(pugi::xml_node lane : side.children("lane")){
                        if(!firstLane) json << ",";
                        firstLane=false;
                        int lid = lane.attribute("id").as_int();
                        const char* ltype = lane.attribute("type").value();
                        json << "{\"id\":"<<lid<<",\"type\":\""<<escape_json(ltype)<<"\",\"widthSeg\":[";
                        bool firstW=true;
                        for(pugi::xml_node wseg : lane.children("width")){
                            if(!firstW) json << ",";
                            firstW=false;
                            double sOff = wseg.attribute("sOffset").as_double();
                            double a=wseg.attribute("a").as_double();
                            double b=wseg.attribute("b").as_double();
                            double c=wseg.attribute("c").as_double();
                            double d=wseg.attribute("d").as_double();
                            json << "{\"sOffset\":"<<sOff<<",\"a\":"<<a<<",\"b\":"<<b<<",\"c\":"<<c<<",\"d\":"<<d<<"}";
                        }
                        json << " ]";
                        pugi::xml_node rm = lane.child("roadMark");
                        if(rm){
                            const char* rmType=rm.attribute("type").value();
                            const char* rmColor=rm.attribute("color").value();
                            double rmWidth=rm.attribute("width").as_double(0.15);
                            json << ",\"roadMark\":{\"type\":\""<<escape_json(rmType)<<"\",\"color\":\""<<escape_json(rmColor)<<"\",\"width\":"<<rmWidth<<"}";
                        }
                        json << "}";
                    }
                }
            }
            json << "]}"; // close lanes array and laneSection
        }
        json << "]"; // close laneSections array

        json << "}"; // close road
    }
    json << "]}";

    return json.str();
}

EMSCRIPTEN_BINDINGS(OpenDriveWasmModule)
{
    emscripten::function("parseXodr", &parseXodr);
} 