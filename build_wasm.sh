#!/bin/bash

# Emscripten SDK 환경 설정 (필요시 경로 수정)
# 예: source /path/to/emsdk/emsdk_env.sh
if ! command -v emcc &> /dev/null
then
    echo "emcc command could not be found. Make sure Emscripten SDK is installed and in your PATH."
    exit
fi

# 소스 파일 목록
# libOpenDRIVE-main의 CMakeLists.txt를 기반으로 작성
# pugixml은 서브모듈 또는 수동으로 libOpenDRIVE-main/pugixml에 위치해야 함
CPP_SOURCES=" \
    libOpenDRIVE-main/src/Geometries/Arc.cpp \
    libOpenDRIVE-main/src/Geometries/CubicSpline.cpp \
    libOpenDRIVE-main/src/Geometries/Line.cpp \
    libOpenDRIVE-main/src/Geometries/ParamPoly3.cpp \
    libOpenDRIVE-main/src/Geometries/RoadGeometry.cpp \
    libOpenDRIVE-main/src/Geometries/Spiral.cpp \
    libOpenDRIVE-main/src/Geometries/Spiral/odrSpiral.cpp \
    libOpenDRIVE-main/src/Junction.cpp \
    libOpenDRIVE-main/src/Lane.cpp \
    libOpenDRIVE-main/src/LaneSection.cpp \
    libOpenDRIVE-main/src/Log.cpp \
    libOpenDRIVE-main/src/Mesh.cpp \
    libOpenDRIVE-main/src/OpenDriveMap.cpp \
    libOpenDRIVE-main/src/RefLine.cpp \
    libOpenDRIVE-main/src/Road.cpp \
    libOpenDRIVE-main/src/RoadMark.cpp \
    libOpenDRIVE-main/src/RoadNetworkMesh.cpp \
    libOpenDRIVE-main/src/RoadObject.cpp \
    libOpenDRIVE-main/src/RoadSignal.cpp \
    libOpenDRIVE-main/src/RoutingGraph.cpp \
    libOpenDRIVE-main/pugixml/src/pugixml.cpp \
    wasm_parser_wrapper.cpp \
    "

# 헤더 포함 경로
INCLUDE_PATHS=" \
    -I./libOpenDRIVE-main/include \
    -I./libOpenDRIVE-main/pugixml/src \
    -I./extern/json/single_include \
    "

echo "Starting WASM build..."

# 빌드 옵션
emcc ${CPP_SOURCES} ${INCLUDE_PATHS} \
    -o OpenDriveWasm.js \
    -std=c++17 \
    -O3 \
    --bind \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s "EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']" \
    -s "ENVIRONMENT='web'"

if [ $? -eq 0 ]; then
    echo "----------------------------------------------------"
    echo "WASM build complete!"
    echo "Output files: OpenDriveWasm.js, OpenDriveWasm.wasm"
    echo "----------------------------------------------------"
else
    echo "----------------------------------------------------"
    echo "WASM build failed."
    echo "----------------------------------------------------"
fi