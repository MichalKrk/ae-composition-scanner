# AE Composition Scanner

Extract complete configuration data from After Effects compositions including voiceovers, subtitles, footages, text boxes, and music.

## Features

- 🎤 **Voice Detection** - Supports Voiceover and ElevenLabs formats
- 📝 **Subtitle Extraction** - Font, colors, transform, and text metrics
- 🎬 **Footage Analysis** - Video layers with timing and order
- 🎵 **Music Detection** - Smart selection with priority logic
- 📦 **Text Box Controls** - Effect parameters extraction
- 🔧 **Fully Automated** - Single script execution

## Installation

### Option 1: Manual Installation

1. Download or clone this repository
2. Copy the `jsx` folder to your After Effects Scripts folder:
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects [version]\Support Files\Scripts\`
   - **macOS:** `/Applications/Adobe After Effects [version]/Scripts/`

### Option 2: Use from CEP Panel

Include the JSX scripts in your CEP extension panel project.

## Usage

### Standalone Mode

Run `generateConfig.jsx` with the standalone flag:

```javascript
// Set standalone mode flag
var GENERATE_CONFIG_STANDALONE = true;

// Load and execute the script
$.evalFile("/path/to/jsx/generateConfig.jsx");
```

This will:
1. Scan the currently selected composition in the Project panel
2. Generate config.json
3. Save it next to your .aep project file
4. Show success/error alert

### Programmatic Usage

```javascript
// Load dependencies
$.evalFile("jsx/libs/polyfills.jsx");
$.evalFile("jsx/libs/json2.jsx");
$.evalFile("jsx/scanCompositionConfig.jsx");
$.evalFile("jsx/generateConfig.jsx");

// Get active composition
var comp = app.project.activeItem;

// Option 1: Scan only (returns JSON string)
var configJSON = scanCompositionConfig(comp);
var config = JSON.parse(configJSON);

// Option 2: Generate and save (returns result with path)
var resultJSON = generateConfigJSON(null, comp);
var result = JSON.parse(resultJSON);

if (result.success) {
  alert("Config saved to: " + result.configPath);
} else {
  alert("Error: " + result.error);
}
```

## Composition Structure Requirements

Your After Effects composition should follow this structure:

```
Main Composition
├── Hook (sub-composition)
│   ├── Voiceover layer (elevenlabs_*, voiceover_*, or 11labs_*)
│   ├── Text layer (for subtitles)
│   ├── Text box control (adjustment or shape layer)
│   └── Footage layers (.mp4 or .mov)
├── Body (sub-composition)
│   └── [same structure as Hook]
├── CTA (sub-composition)
│   └── [same structure as Hook]
└── Music layer (audio file, preferably Music_*.mp3)
```

### Section Detection

- **Exact match priority:** Layer named exactly "hook", "body", or "cta" (case-insensitive)
- **Partial match fallback:** Layer name contains "hook", "body", or "cta"

### Music Selection Logic

**Priority 1:** Layer name starts with `Music_` or `music_`
**Priority 2:** Longest audio layer

**Excluded from music:**
- Layers starting with `Voiceover_`, `ElevenLabs_`, `11labs_`, `SFX_`

### Voiceover Formats

#### Voiceover Format
```
Voiceover_{VoiceName}_{VoiceID}_{Timestamp}.mp3
```
- Has `voiceID` (20-character alphanumeric)
- No `cloneType`

#### ElevenLabs Format
```
ElevenLabs_{Timestamp}_{VoiceName}_{CloneType}_{Parameters}.mp3
```
- No `voiceID` (null)
- Has `cloneType` (e.g., "pre", "ivc")

## Output Format

The scanner generates a JSON file with this structure:

```json
{
  "compositionName": "Main_Composition",
  "Hook": {
    "compositionName": "Hook",
    "voice": { /* voiceover data */ },
    "subtitles": { /* text layer data */ },
    "textBoxes": { /* control parameters */ },
    "footages": [ /* video layers */ ]
  },
  "Body": { /* same structure */ },
  "CTA": { /* same structure */ },
  "music": { /* single music layer */ }
}
```

See [`docs/config-guide.md`](docs/config-guide.md) for complete documentation.

## Documentation

- **[Configuration Guide](docs/config-guide.md)** - Complete documentation with examples and edge cases
- **[JSON Schema](docs/config-schema.json)** - Formal schema definition for validation
- **[Full Example](docs/config-example-full.json)** - Real-world config.json example

## API Reference

### `scanCompositionConfig(compItem)`

Scans a composition and returns configuration data.

**Parameters:**
- `compItem` (CompItem, optional) - Composition to scan. If not provided, uses Project panel selection.

**Returns:** JSON string with structure:
```javascript
{
  "success": true,
  "config": { /* configuration object */ }
}
// or
{
  "error": "Error message"
}
```

### `generateConfigJSON(saveFolder, compItem)`

Generates config and saves to file.

**Parameters:**
- `saveFolder` (string, optional) - Folder path to save config.json. If null, saves to project folder.
- `compItem` (CompItem, optional) - Composition to scan. If not provided, uses Project panel selection.

**Returns:** JSON string with structure:
```javascript
{
  "success": true,
  "configPath": "/path/to/config.json",
  "compositionName": "composition_name"
}
// or
{
  "success": false,
  "error": "Error message"
}
```

## Error Handling

The scanner validates:
- ✅ Project is open and saved
- ✅ Composition is selected
- ✅ File write permissions
- ✅ Layer structure integrity

All errors are returned in a structured JSON format with descriptive messages.

## Requirements

- Adobe After Effects CC 2018 or later
- ExtendScript support
- Project must be saved (.aep file)

## Use Cases

- **Automated Workflows** - Extract composition data for processing pipelines
- **Asset Management** - Inventory voiceovers, footages, and music
- **Quality Control** - Validate composition structure before rendering
- **Data Export** - Transfer composition metadata to external systems
- **n8n Integration** - Send config data to n8n workflows
- **Batch Processing** - Scan multiple compositions programmatically

## Troubleshooting

### "No composition selected"
- Select a composition in the Project panel before running
- OR pass a CompItem to the function

### "Project has not been saved"
- Save your .aep file first (File → Save)

### Config.json not found after generation
- Check the folder where your .aep file is saved
- Verify file write permissions

### Section returns null
- Ensure sub-composition is named "hook", "body", or "cta" (case-insensitive)
- Check that the layer is a CompItem, not a footage

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Changelog

### 2025-12-30
- Initial release
- Music selection changed to single object (not array)
- Smart music priority (Music_ prefix, then longest)
- Removed `startTime` from footages
- Removed `filePath` from music
- Added comprehensive documentation

## Author

Created for automated After Effects composition workflows.

## Links

- [Documentation](docs/config-guide.md)
- [JSON Schema](docs/config-schema.json)
- [Example Config](docs/config-example-full.json)
