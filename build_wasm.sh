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

# Determine CPU core count for parallel build
if command -v nproc &>/dev/null; then
    CORES=$(nproc)
elif [[ "$OSTYPE" == "darwin"* ]]; then
    CORES=$(sysctl -n hw.ncpu)
else
    CORES=16
fi

echo "Using $CORES parallel jobs"

# Convert CPP_SOURCES string into array (word-split by whitespace)
read -r -a SRC_ARRAY <<< "$CPP_SOURCES"
TOTAL=${#SRC_ARRAY[@]}

OBJ_DIR=build_obj_wasm
mkdir -p "$OBJ_DIR"

# 1) Compile each source file to .o in parallel with progress indicator
INDEX=0
for SRC in "${SRC_ARRAY[@]}"; do
    ((INDEX++))
    O_FILE="$OBJ_DIR/$(basename "${SRC%.cpp}.o")"
    echo "[${INDEX}/${TOTAL}] Compiling $(basename $SRC)" >&2
    emcc -c $SRC ${INCLUDE_PATHS} -std=c++17 -O3 --bind -o "$O_FILE" &
    # Limit number of parallel background jobs
    while [ $(jobs -pr | wc -l) -ge $CORES ]; do
        sleep 0.1
    done
done
wait

echo "Linking object files ..." >&2

# 2) Link all objects into final WASM
emcc $OBJ_DIR/*.o \
    -o OpenDriveWasm.js \
    --bind \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap']" \
    -s FORCE_FILESYSTEM=1 \
    -s "ENVIRONMENT='web'" \
    -O3

# Clean up object files if link succeeded
if [ $? -eq 0 ]; then
    echo "----------------------------------------------------"
    echo "WASM build complete!"
    echo "Output files: OpenDriveWasm.js, OpenDriveWasm.wasm"
    echo "Cleaning intermediate objects ..." >&2
    rm -rf "$OBJ_DIR"
    echo "----------------------------------------------------"
else
    echo "----------------------------------------------------"
    echo "WASM build failed. (See errors above)" >&2
    echo "----------------------------------------------------"
fi