# OpenDRIVE 3D Viewer

Web-based 3D visualization system for OpenDRIVE format files using libOpenDRIVE and Three.js.

## 🚀 Features

- **High-Performance Parsing**: Uses libOpenDRIVE-0.3.0 compiled to WASM for optimal performance
- **Interactive 3D Visualization**: Powered by Three.js with smooth navigation controls
- **Comprehensive Data Access**: Displays all available OpenDRIVE data including roads, junctions, lane markings, and objects
- **Origin Visualization**: Shows both map center and actual OpenDRIVE (0,0) coordinate positions
- **Debug Panel**: Detailed analysis of map structure, geometry data, and coordinate systems
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-time Tooltips**: Interactive raycasting for object information display

## 🛠 Technical Architecture

- **Frontend**: Pure HTML5/CSS3/JavaScript (ES6+)
- **3D Engine**: Three.js for WebGL rendering
- **Parser**: libOpenDRIVE-0.3.0 → Emscripten → WASM
- **Coordinate System**: OpenDRIVE (Z-up) to Three.js (Y-up) conversion
- **Design Pattern**: Modular architecture following single responsibility principle

## 📦 Project Structure

```
OpenDRIVEViewer/
├── index.html              # Main application file
├── ModuleOpenDrive.js       # WASM JavaScript bindings (101KB)
├── ModuleOpenDrive.wasm     # Compiled libOpenDRIVE library (407KB)
├── Maps/                    # Test OpenDRIVE files
│   ├── Germany_2018.xodr    # Large test map (12MB)
│   └── Crossing8Course.xodr # Small test map (87KB)
├── libOpenDRIVE-0.3.0/      # Source library
└── backup/                  # Development backups
```

## 🚦 Getting Started

### Prerequisites
- Modern web browser with WebGL support
- HTTP server (CORS restrictions prevent file:// protocol usage)

### Installation & Usage

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd OpenDRIVEViewer
   ```

2. **Start HTTP server**
   
   Using Python (recommended):
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```
   
   Using Node.js:
   ```bash
   npx serve -s . -p 8000
   ```
   
   Using VS Code Live Server extension (recommended for development)

3. **Open in browser**
   Navigate to `http://localhost:8000`

### Loading OpenDRIVE Files

1. Click "파일 선택" (Choose File) button
2. Select your .xodr OpenDRIVE file
3. The system will automatically parse and visualize the map
4. Use mouse controls for navigation:
   - **Left click + drag**: Orbit around
   - **Right click + drag**: Pan
   - **Scroll wheel**: Zoom in/out

## 🎛 Controls & Features

### Layer Controls
- **도로 표시**: Toggle road surfaces
- **차선 마킹**: Toggle lane markings  
- **도로 객체**: Toggle road objects
- **교차로**: Toggle junctions
- **맵 중심점**: Toggle map center indicator (red sphere)
- **실제 원점**: Toggle OpenDRIVE (0,0) position (orange diamond)
- **좌표축**: Toggle 3D coordinate axes

### Debug Panel
- **맵 기본 정보**: File details, coordinate system, offsets
- **전역 함수 결과**: Roads/junctions/reference lines count
- **메시 분석**: Detailed mesh statistics
- **도로 상세 정보**: Individual road properties
- **교차로 정보**: Junction details and connections
- **메시 형상 데이터**: Vertex/index samples, ST coordinates
- **참조선 데이터**: Reference line geometry

## 🎯 Key Technical Concepts

### Coordinate System Handling
- **OpenDRIVE**: Uses Z-up coordinate system
- **Three.js**: Uses Y-up coordinate system
- **Conversion**: Automatic transformation with `(x, z, -y)` mapping

### Origin Points
- **Map Center** (Red Sphere): Result of `center_map=true` processing
- **Real Origin** (Orange Diamond): Actual OpenDRIVE (0,0) coordinate position
- **Offset Calculation**: `realOrigin = -mapOffset` for accurate positioning

### Performance Optimization
- **WASM Direct Memory Access**: Eliminates data copy overhead
- **Batch Geometry Creation**: Efficient Three.js mesh generation
- **Layer-based Rendering**: Independent visibility controls
- **Responsive Design**: Optimized for various screen sizes

## 🔧 Development Guidelines

This project follows the **Cursor Rules** software engineering principles:

- **Single Responsibility**: Each function has one clear responsibility
- **System Thinking**: Considers entire system interactions
- **Modular Design**: Independent, testable components
- **Cost-Benefit Analysis**: Balanced complexity vs. functionality
- **Evolutionary Design**: Gradual improvement based on feedback

## 📊 Supported Data Types

### Roads
- Geometry (lines, spirals, arcs)
- Lane information and markings
- Elevation profiles
- Road objects and signs

### Junctions
- Connection paths
- Lane links
- Priority settings
- Traffic light positions

### Reference Lines
- 3D curves and geometry
- ST coordinate mappings
- Parametric representations

## 🌐 Browser Compatibility

- **Chrome**: 88+ (recommended for best performance)
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

## 📝 License

This project uses libOpenDRIVE-0.3.0 under its respective license terms.

## 🤝 Contributing

1. Follow the established coding conventions
2. Maintain single responsibility principle
3. Add comprehensive debug information for new features
4. Test with various OpenDRIVE file formats
5. Ensure responsive design compatibility

## 📞 Support

For technical issues or feature requests, please refer to the project documentation or create an issue.

---

**Note**: This viewer is optimized for educational and development purposes. For production use, consider additional error handling and performance optimizations based on your specific requirements. 