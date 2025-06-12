#include <string>
#include <emscripten/bind.h>

// TODO: 실제 libOpenDRIVE-main 파서를 연동하여 JSON을 생성하도록 개선합니다.
// 현재는 빌드 테스트를 위해 간단한 스텁을 제공합니다.
std::string parseXodr(const std::string& xodrContent) {
    // 간단한 예시로 XODR 문자열 길이만 반환
    return std::string("{\"length\": ") + std::to_string(xodrContent.size()) + "}";
}

EMSCRIPTEN_BINDINGS(OpenDriveWasmModule) {
    emscripten::function("parseXodr", &parseXodr);
} 