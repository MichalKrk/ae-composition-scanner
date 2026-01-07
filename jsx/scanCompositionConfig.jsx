/**
 * scanCompositionConfig.jsx
 * Scans selected composition and extracts complete configuration
 * including sections (Hook/Body/CTA), text boxes, voiceovers, subtitles, footages, and music
 */

/**
 * Main function to scan composition and save config to JSON file
 * @param {CompItem} [compItem] - Optional: composition to scan. If not provided, uses project selection
 * @returns {string} JSON string with result or error message
 */
function scanCompositionConfig(compItem) {
    try {
        var project = app.project;

        if (!project) {
            return JSON.stringify({ error: "No project is open" });
        }

        if (!project.file) {
            return JSON.stringify({ error: "Project has not been saved yet. Please save the project first." });
        }

        var selectedComp = null;

        // If composition is passed as parameter, use it
        if (compItem && compItem instanceof CompItem) {
            selectedComp = compItem;
        } else {
            // Otherwise, get selected composition from Project panel
            var selectedItems = project.selection;
            if (selectedItems.length === 0) {
                return JSON.stringify({ error: "No composition selected. Please select a composition in the Project panel." });
            }

            for (var i = 0; i < selectedItems.length; i++) {
                if (selectedItems[i] instanceof CompItem) {
                    selectedComp = selectedItems[i];
                    break;
                }
            }

            if (!selectedComp) {
                return JSON.stringify({ error: "Selected item is not a composition. Please select a composition." });
            }
        }

        // Scan composition structure
        var config = {
            compositionName: selectedComp.name,
            aeVersion: null,  // Will be populated later
            fonts: [],        // Will be populated later
            plugins: [],      // Will be populated later
            Hook: null,
            Body: null,
            CTA: null,
            music: null
        };

        var targetSections = ["hook", "body", "cta"];
        var sectionComps = {}; // Store found section compositions

        // Find Hook/Body/CTA sub-compositions
        for (var i = 1; i <= selectedComp.numLayers; i++) {
            var layer = selectedComp.layer(i);

            // Check if layer is a precomp
            if (layer instanceof AVLayer && layer.source instanceof CompItem) {
                var layerName = layer.name.toLowerCase();

                // Check each target section
                for (var s = 0; s < targetSections.length; s++) {
                    var sectionName = targetSections[s];

                    // Exact match priority
                    if (layerName === sectionName) {
                        sectionComps[sectionName] = {
                            comp: layer.source,
                            layer: layer,
                            exact: true
                        };
                    }
                    // Partial match fallback
                    else if (!sectionComps[sectionName] && layerName.indexOf(sectionName) !== -1 && layerName.indexOf("transition") === -1) {
                        sectionComps[sectionName] = {
                            comp: layer.source,
                            layer: layer,
                            exact: false
                        };
                    }
                }
            }
        }

        // Collect metadata (AE version, fonts, plugins) before scanning sections
        config.aeVersion = _getAEVersion();
        config.fonts = _collectAllFonts(selectedComp, sectionComps);
        config.plugins = _collectAllPlugins(selectedComp, sectionComps);

        // Scan each found section in proper order: Hook -> Body -> CTA
        var sectionOrder = ["hook", "body", "cta"];
        var sectionKeyMapping = {
            "hook": "Hook",
            "body": "Body",
            "cta": "CTA"
        };

        for (var s = 0; s < sectionOrder.length; s++) {
            var sectionKey = sectionOrder[s];
            if (sectionComps[sectionKey]) {
                var sectionData = sectionComps[sectionKey];
                var subComp = sectionData.comp;
                var sectionLayer = sectionData.layer;
                var configKey = sectionKeyMapping[sectionKey];

                config[configKey] = _scanSection(subComp, sectionLayer, sectionKey);
            }
        }

        // Scan music (audio layers in main composition)
        config.music = _scanMusicLayers(selectedComp);

        // Return the config as JSON (file saving will be done from JS side if needed)
        return JSON.stringify({
            success: true,
            config: config
        });

    } catch (error) {
        return JSON.stringify({
            error: "Error scanning composition: " + error.toString()
        });
    }
}

/**
 * Gets After Effects version number
 * @returns {string} Version string (e.g., "24.1.0")
 */
function _getAEVersion() {
    try {
        return app.version.toString();
    } catch (e) {
        return "unknown";
    }
}

/**
 * Scans a section composition and extracts all data
 * @param {CompItem} comp - Section composition
 * @param {Layer} sectionLayer - Layer in main composition
 * @param {string} sectionName - Section name (hook, body, cta)
 * @returns {object} Section configuration
 */
function _scanSection(comp, sectionLayer, sectionName) {
    var sectionConfig = {
        compositionName: comp.name,
        voice: null,
        subtitles: null,
        textBoxes: null,
        footages: []
    };

    // Scan for voiceovers
    var voiceResult = _scanCompositionForVoiceovers(comp, sectionName);
    if (voiceResult.voiceover) {
        sectionConfig.voice = voiceResult.voiceover;
    }

    // Scan for text layers (subtitles)
    var textResult = _scanCompositionForTextLayer(comp, sectionName);
    if (textResult.subtitle) {
        sectionConfig.subtitles = textResult.subtitle;
    }

    // Scan for text boxes
    sectionConfig.textBoxes = _scanTextBoxControl(comp);

    // Scan for footages
    sectionConfig.footages = _scanFootageLayers(comp);

    return sectionConfig;
}

/**
 * Scans composition for footage/video layers
 * @param {CompItem} comp - Composition to scan
 * @returns {Array} Array of footage layer data
 */
function _scanFootageLayers(comp) {
    var footages = [];
    var voiceTags = ["elevenlabs_", "11labs_", "voiceover_"];

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        // Skip if no source
        if (!layer.source) continue;

        // Skip text layers and shape layers
        if (layer instanceof TextLayer || layer instanceof ShapeLayer) continue;

        // Skip adjustment layers
        if (layer.adjustmentLayer) continue;

        // Skip camera and light layers
        if (layer instanceof CameraLayer || layer instanceof LightLayer) continue;

        // Check if it's a voiceover (skip it from footages)
        var sourceName = layer.source.name;
        var sourceNameLower = sourceName.toLowerCase();
        var isVoiceover = false;

        for (var t = 0; t < voiceTags.length; t++) {
            if (sourceNameLower.indexOf(voiceTags[t]) !== -1) {
                isVoiceover = true;
                break;
            }
        }

        if (isVoiceover) continue;

        // Only include .mp4 and .mov files
        if (layer.source.file) {
            var filePath = layer.source.file.fsName;
            var fileExtension = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

            if (fileExtension !== ".mp4" && fileExtension !== ".mov") {
                continue; // Skip non-video files
            }
        } else {
            continue; // Skip if no file (e.g., solids, compositions)
        }

        // This is a valid footage layer
        var footageData = {
            layerName: layer.name,
            sourceName: sourceName,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            duration: layer.outPoint - layer.inPoint,
            enabled: layer.enabled
        };

        footages.push(footageData);
    }

    // Sort by inPoint (earliest first) and assign order
    footages.sort(function(a, b) {
        return a.inPoint - b.inPoint;
    });

    // Assign order numbers
    for (var f = 0; f < footages.length; f++) {
        footages[f].order = f + 1;
    }

    return footages;
}

/**
 * Scans main composition for music layer (returns single music layer, not array)
 * Priority 1: Layer name starts with "Music_" or "music_"
 * Priority 2: Longest audio layer
 * Excludes: Voiceover_, ElevenLabs_, 11labs_, SFX_
 * @param {CompItem} comp - Main composition
 * @returns {Object|null} Single music layer data or null
 */
function _scanMusicLayers(comp) {
    var excludePrefixes = ["Voiceover_", "ElevenLabs_", "11labs_", "SFX_"];
    var musicPrefixes = ["Music_", "music_"];

    var eligibleLayers = [];
    var musicPriorityLayer = null;

    // Collect all eligible audio layers
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        // Check if layer has audio
        if (!layer.hasAudio) continue;

        // Skip if it's a precomp (we only want direct audio files)
        if (layer.source instanceof CompItem) continue;

        // Skip if audio is disabled
        if (!layer.audioEnabled) continue;

        var layerName = layer.name;

        // Check if layer should be excluded
        var shouldExclude = false;
        for (var e = 0; e < excludePrefixes.length; e++) {
            if (layerName.indexOf(excludePrefixes[e]) === 0) {
                shouldExclude = true;
                break;
            }
        }
        if (shouldExclude) continue;

        // Check if this is a priority music layer (starts with Music_ or music_)
        var isMusicPriority = false;
        for (var m = 0; m < musicPrefixes.length; m++) {
            if (layerName.indexOf(musicPrefixes[m]) === 0) {
                isMusicPriority = true;
                break;
            }
        }

        var layerData = {
            layer: layer,
            layerName: layerName,
            layerIndex: i,
            duration: layer.outPoint - layer.inPoint,
            isMusicPriority: isMusicPriority
        };

        // If this is a Music_ layer, prioritize it
        if (isMusicPriority && !musicPriorityLayer) {
            musicPriorityLayer = layerData;
        }

        eligibleLayers.push(layerData);
    }

    // If no eligible layers found, return null
    if (eligibleLayers.length === 0) return null;

    // Select the music layer: priority to Music_ layers, then longest
    var selectedLayer = null;
    if (musicPriorityLayer) {
        selectedLayer = musicPriorityLayer;
    } else {
        // Find longest audio layer
        var longestLayer = eligibleLayers[0];
        for (var i = 1; i < eligibleLayers.length; i++) {
            if (eligibleLayers[i].duration > longestLayer.duration) {
                longestLayer = eligibleLayers[i];
            }
        }
        selectedLayer = longestLayer;
    }

    // Build music data object (without filePath)
    var layer = selectedLayer.layer;
    var musicData = {
        layerName: layer.name,
        layerIndex: selectedLayer.layerIndex,
        sourceName: layer.source ? layer.source.name : "Unknown",
        inPoint: layer.inPoint,
        outPoint: layer.outPoint,
        duration: selectedLayer.duration,
        enabled: layer.enabled,
        audioLevels: _extractAudioLevels(layer)
    };

    return musicData;
}

/**
 * Extracts audio levels from layer
 * @param {Layer} layer - Layer with audio
 * @returns {object} Audio levels data
 */
function _extractAudioLevels(layer) {
    try {
        var audioGroup = layer.property("ADBE Audio Group");
        if (!audioGroup) return null;

        var audioLevels = audioGroup.property("ADBE Audio Levels");
        if (!audioLevels) return null;

        return {
            value: audioLevels.value,
            isAnimated: audioLevels.numKeys > 0,
            numKeys: audioLevels.numKeys
        };
    } catch (e) {
        return null;
    }
}

/**
 * Gets source type description
 * @param {Item} source - Source item
 * @returns {string} Source type
 */
function _getSourceType(source) {
    if (source instanceof CompItem) {
        return "Composition";
    } else if (source instanceof FootageItem) {
        if (source.mainSource instanceof SolidSource) {
            return "Solid";
        } else if (source.mainSource instanceof FileSource) {
            return "File";
        } else {
            return "Footage";
        }
    }
    return "Unknown";
}

/**
 * Extracts transform properties from layer
 * @param {Layer} layer - Layer to extract from
 * @returns {object} Transform properties
 */
function _extractTransformProperties(layer) {
    try {
        var transform = layer.property("Transform");

        var position = null;
        var anchorPoint = null;
        var scale = null;
        var rotation = null;
        var opacity = null;

        var positionProp = transform.property("Position");
        if (positionProp) {
            position = {
                value: positionProp.value,
                isAnimated: positionProp.numKeys > 0,
                numKeys: positionProp.numKeys
            };
        }

        var anchorPointProp = transform.property("Anchor Point");
        if (anchorPointProp) {
            anchorPoint = {
                value: anchorPointProp.value,
                isAnimated: anchorPointProp.numKeys > 0,
                numKeys: anchorPointProp.numKeys
            };
        }

        var scaleProp = transform.property("Scale");
        if (scaleProp) {
            scale = {
                value: scaleProp.value,
                isAnimated: scaleProp.numKeys > 0,
                numKeys: scaleProp.numKeys
            };
        }

        var rotationProp = transform.property("Rotation");
        if (rotationProp) {
            rotation = {
                value: rotationProp.value,
                isAnimated: rotationProp.numKeys > 0,
                numKeys: rotationProp.numKeys
            };
        }

        var opacityProp = transform.property("Opacity");
        if (opacityProp) {
            opacity = {
                value: opacityProp.value,
                isAnimated: opacityProp.numKeys > 0,
                numKeys: opacityProp.numKeys
            };
        }

        return {
            position: position,
            anchorPoint: anchorPoint,
            scale: scale,
            rotation: rotation,
            opacity: opacity
        };
    } catch (e) {
        return null;
    }
}

/**
 * Scans composition for text box control layers
 * @param {CompItem} comp - Composition to scan
 * @returns {object|null} Text box control data
 */
function _scanTextBoxControl(comp) {
    var controlMapping = {
        "accent box control": "Accent",
        "adaptive box control": "Adaptive",
        "text box control": "Text"
    };

    // PRIORITY 1: Scan for Control adjustment layers
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        if (!layer.adjustmentLayer) continue;

        var layerNameLower = layer.name.toLowerCase();

        for (var controlName in controlMapping) {
            if (controlMapping.hasOwnProperty(controlName)) {
                if (layerNameLower === controlName) {
                    return {
                        boxType: controlMapping[controlName],
                        layerName: layer.name,
                        parameters: _extractBoxControlParameters(layer)
                    };
                }
            }
        }
    }

    // PRIORITY 2: Scan for Box shape layers
    var boxMapping = {
        "box_accent": "Accent",
        "box accent": "Accent",
        "box_adaptive": "Adaptive",
        "text-box": "Adaptive",
        "box_text": "Text"
    };

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        if (!(layer instanceof ShapeLayer)) continue;
        if (!layer.enabled) continue;

        var layerNameLower = layer.name.toLowerCase();

        for (var boxName in boxMapping) {
            if (boxMapping.hasOwnProperty(boxName)) {
                if (layerNameLower.indexOf(boxName) !== -1) {
                    return {
                        boxType: boxMapping[boxName],
                        layerName: layer.name,
                        parameters: _extractBoxControlParameters(layer)
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Extracts parameters from box control layer
 * @param {Layer} layer - Box control layer
 * @returns {object} Box parameters
 */
function _extractBoxControlParameters(layer) {
    var params = {};

    try {
        var effects = layer.property("ADBE Effect Parade");
        if (!effects) return params;

        for (var i = 1; i <= effects.numProperties; i++) {
            var effect = effects.property(i);
            var effectName = effect.name;

            // Extract Color parameter
            var colorParam = effect.property("Color");
            if (colorParam) {
                var colorValue = colorParam.value;
                params[effectName] = {
                    type: "Color",
                    value: [
                        Math.round(colorValue[0] * 255),
                        Math.round(colorValue[1] * 255),
                        Math.round(colorValue[2] * 255)
                    ]
                };
            }

            // Extract Slider parameter
            var sliderParam = effect.property("Slider");
            if (sliderParam) {
                params[effectName] = {
                    type: "Slider",
                    value: sliderParam.value
                };
            }
        }
    } catch (e) {
        // Error extracting parameters
    }

    return params;
}

/**
 * Parses voiceover name to extract voice name, voice ID, and format
 * @param {string} name - Layer or source name
 * @returns {object} Parsed voiceover data
 */
function _parseVoiceoverName(name) {
    if (!name) {
        return { voiceName: null, voiceID: null, format: "unknown", isSanitized: false };
    }

    var cleanName = name.replace(/\.(wav|mp3)$/i, '');
    var lowerName = cleanName.toLowerCase();

    // ElevenLabs format: ElevenLabs_2025-11-03T12_27_10_VoiceName_ivc_sp100...
    if (lowerName.indexOf('elevenlabs_') === 0) {
        var parts = cleanName.split('_');
        if (parts.length >= 6) {
            return {
                voiceName: parts[4],
                voiceID: null,
                format: "ElevenLabs",
                cloneType: parts[5],
                isSanitized: false
            };
        }
    }

    // Voiceover format: Voiceover_Sarah or Voiceover_Sarah_VoiceID
    if (lowerName.indexOf('voiceover_') === 0) {
        var parts = cleanName.split('_');
        if (parts.length >= 2) {
            var voiceID = null;
            // Check if third part is a 20-char VoiceID
            if (parts.length >= 3 && parts[2].length === 20 && /^[a-zA-Z0-9]{20}$/.test(parts[2])) {
                voiceID = parts[2];
            }
            return {
                voiceName: parts[1],
                voiceID: voiceID,
                format: "Voiceover",
                isSanitized: false
            };
        }
    }

    // 11labs format: 11labs_VoiceName_VoiceID or 11labs_Sanitized__Name_timestamp
    if (lowerName.indexOf('11labs_') === 0) {
        var parts = cleanName.split('_');
        if (parts.length >= 3) {
            var lastPart = parts[parts.length - 1];
            var isVoiceID = lastPart.length === 20 && /^[a-zA-Z0-9]{20}$/.test(lastPart);
            var isTimestamp = /^\d{13}$/.test(lastPart);

            var voiceID = null;
            var endIndex = parts.length;

            if (isVoiceID) {
                voiceID = lastPart;
                endIndex = parts.length - 1;
            } else if (isTimestamp) {
                endIndex = parts.length - 1;
            }

            var voiceNameParts = [];
            for (var i = 1; i < endIndex; i++) {
                voiceNameParts.push(parts[i]);
            }
            var voiceName = voiceNameParts.join('_');

            return {
                voiceName: voiceName,
                voiceID: voiceID,
                format: "11labs",
                isSanitized: true
            };
        }
    }

    return { voiceName: null, voiceID: null, format: "unknown", isSanitized: false };
}

/**
 * Scans composition for voiceover layers
 * @param {CompItem} comp - Composition to scan
 * @param {string} section - Section name
 * @returns {object} Voiceover data
 */
function _scanCompositionForVoiceovers(comp, section) {
    var voiceTags = ["elevenlabs_", "11labs_", "voiceover_"];
    var candidates = [];

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        if (!layer.source) continue;
        if (layer.hasAudio && !layer.audioEnabled) continue;

        var sourceName = layer.source.name;
        var sourceNameLower = sourceName.toLowerCase();
        var layerNameLower = layer.name.toLowerCase();

        var isVoiceover = false;
        for (var t = 0; t < voiceTags.length; t++) {
            if (sourceNameLower.indexOf(voiceTags[t]) !== -1 || layerNameLower.indexOf(voiceTags[t]) !== -1) {
                isVoiceover = true;
                break;
            }
        }

        if (isVoiceover) {
            // Parse voiceover name
            var nameToparse = sourceName;
            var parsed = _parseVoiceoverName(nameToparse);

            // If sourceName parsing failed, try layerName
            if (parsed.format === "unknown" && layer.name !== sourceName) {
                var layerParsed = _parseVoiceoverName(layer.name);
                if (layerParsed.format !== "unknown") {
                    parsed = layerParsed;
                }
            }

            candidates.push({
                sourceName: sourceName,
                layerName: layer.name,
                voiceName: parsed.voiceName,
                voiceID: parsed.voiceID,
                format: parsed.format,
                isSanitized: parsed.isSanitized,
                cloneType: parsed.cloneType || null
            });
        }
    }

    if (candidates.length === 0) {
        return { voiceover: null };
    }

    return { voiceover: candidates[0] };
}

/**
 * Scans composition for text layers
 * @param {CompItem} comp - Composition to scan
 * @param {string} section - Section name
 * @returns {object} Text layer data
 */
function _scanCompositionForTextLayer(comp, section) {
    var candidates = [];

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        if (!(layer instanceof TextLayer)) continue;
        if (!layer.enabled) continue;

        candidates.push({
            layer: layer,
            layerIndex: i
        });
    }

    if (candidates.length === 0) {
        return { subtitle: null };
    }

    var selected = candidates[0].layer;
    var textData = _analyzeTextLayer(selected, section, comp.name);

    return { subtitle: textData };
}

/**
 * Analyzes text layer and extracts properties
 * @param {TextLayer} textLayer - Text layer
 * @param {string} section - Section name
 * @param {string} compName - Composition name
 * @returns {object} Text layer data
 */
function _analyzeTextLayer(textLayer, section, compName) {
    var textDoc = textLayer.property("Source Text").value;
    var textContent = textDoc.text;

    var fontName = textDoc.font;
    var fontSize = textDoc.fontSize;
    var fillColor = textDoc.fillColor;

    var fillColorRGB = [
        Math.round(fillColor[0] * 255),
        Math.round(fillColor[1] * 255),
        Math.round(fillColor[2] * 255)
    ];

    var strokeColor = [0, 0, 0];
    var strokeWidth = 0;
    var applyStroke = false;

    try {
        strokeColor = textDoc.strokeColor || [0, 0, 0];
        strokeWidth = textDoc.strokeWidth || 0;
        applyStroke = textDoc.applyStroke || false;
    } catch (e) {}

    var strokeColorRGB = [
        Math.round(strokeColor[0] * 255),
        Math.round(strokeColor[1] * 255),
        Math.round(strokeColor[2] * 255)
    ];

    var tracking = 0;
    var leading = null;
    var autoLeading = true;

    try {
        tracking = textDoc.tracking || 0;
        autoLeading = textDoc.autoLeading !== undefined ? textDoc.autoLeading : true;
        if (!autoLeading) {
            leading = textDoc.leading || null;
        }
    } catch (e) {}

    var textAnalysis = _analyzeTextContent(textContent);

    return {
        fontName: fontName,
        fontSize: fontSize,
        fillColor: fillColorRGB,
        strokeColor: strokeColorRGB,
        strokeWidth: strokeWidth,
        applyStroke: applyStroke,
        fontCapsOption: _getFontCapsOption(textDoc),
        tracking: tracking,
        leading: leading,
        autoLeading: autoLeading,
        numLines: textAnalysis.numLines,
        maxChars: textAnalysis.maxChars,
        wordCount: textAnalysis.wordCount,
        transform: _extractTransformProperties(textLayer)
    };
}

/**
 * Gets font caps option
 * @param {TextDocument} textDoc - Text document
 * @returns {string} Font caps option
 */
function _getFontCapsOption(textDoc) {
    try {
        var capsOption = textDoc.fontCapsOption;

        if (typeof FontCapsOption !== 'undefined') {
            if (capsOption === FontCapsOption.FONT_ALL_CAPS) {
                return "FONT_ALL_CAPS";
            } else if (capsOption === FontCapsOption.FONT_SMALL_CAPS) {
                return "FONT_SMALL_CAPS";
            } else if (capsOption === FontCapsOption.FONT_ALL_SMALL_CAPS) {
                return "FONT_ALL_SMALL_CAPS";
            } else if (capsOption === FontCapsOption.FONT_NORMAL_CAPS) {
                return "FONT_NORMAL_CAPS";
            }
        }

        return "FONT_NORMAL_CAPS";
    } catch (e) {
        return "FONT_NORMAL_CAPS";
    }
}

/**
 * Analyzes text content
 * @param {string} text - Text content
 * @returns {object} Analysis results
 */
function _analyzeTextContent(text) {
    if (!text) {
        return { numLines: 0, maxChars: 0, wordCount: 0 };
    }

    var lines = text.split(/\r\n|\r|\n|\x03/);
    var numLines = lines.length;

    var allWords = text.split(/\s+/).filter(function(word) {
        return word.length > 0;
    });
    var wordCount = allWords.length;

    var maxChars = 0;

    if (wordCount === 1) {
        maxChars = 1;
    } else {
        for (var i = 0; i < lines.length; i++) {
            var lineLength = lines[i].length;
            if (lineLength > maxChars) {
                maxChars = lineLength;
            }
        }
    }

    return {
        numLines: numLines,
        maxChars: maxChars,
        wordCount: wordCount
    };
}

/**
 * Capitalizes first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function _capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Recursively scans composition and nested precomps for fonts
 * @param {CompItem} comp - Composition to scan
 * @param {Object} visitedComps - Object tracking visited comp IDs to avoid loops
 * @param {Object} fontSet - Object used as set to track unique fonts
 */
function _scanFontsRecursive(comp, visitedComps, fontSet) {
    // Avoid infinite loops
    if (!comp || !comp.id || visitedComps[comp.id]) return;
    visitedComps[comp.id] = true;

    // Scan all layers in this composition
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        // If it's a text layer, extract font
        if (layer instanceof TextLayer) {
            try {
                var textDoc = layer.property("Source Text").value;
                var fontName = textDoc.font;
                if (fontName) {
                    fontSet[fontName] = true; // Use object as set
                }
            } catch (e) {
                // Skip if can't read text properties
            }
        }

        // If it's a precomp, recurse into it
        if (layer instanceof AVLayer && layer.source instanceof CompItem) {
            _scanFontsRecursive(layer.source, visitedComps, fontSet);
        }
    }
}

/**
 * Collects all unique fonts from main composition and sections
 * @param {CompItem} mainComp - Main composition
 * @param {Object} sectionComps - Object with hook/body/cta section data
 * @returns {Array<string>} Sorted array of unique font names
 */
function _collectAllFonts(mainComp, sectionComps) {
    var fontSet = {};
    var visitedComps = {};

    // Scan main composition
    _scanFontsRecursive(mainComp, visitedComps, fontSet);

    // Scan section compositions
    var sectionKeys = ["hook", "body", "cta"];
    for (var i = 0; i < sectionKeys.length; i++) {
        var sectionKey = sectionKeys[i];
        if (sectionComps[sectionKey] && sectionComps[sectionKey].comp) {
            _scanFontsRecursive(sectionComps[sectionKey].comp, visitedComps, fontSet);
        }
    }

    // Convert set to sorted array
    var fonts = [];
    for (var font in fontSet) {
        if (fontSet.hasOwnProperty(font)) {
            fonts.push(font);
        }
    }
    fonts.sort();

    return fonts;
}

/**
 * Recursively scans composition and nested precomps for effects/plugins
 * @param {CompItem} comp - Composition to scan
 * @param {Object} visitedComps - Object tracking visited comp IDs to avoid loops
 * @param {Object} pluginSet - Object used as set to track unique plugins
 */
function _scanPluginsRecursive(comp, visitedComps, pluginSet) {
    // Avoid infinite loops
    if (!comp || !comp.id || visitedComps[comp.id]) return;
    visitedComps[comp.id] = true;

    // Scan all layers in this composition
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        try {
            // Get effects property group
            var effects = layer.property("ADBE Effect Parade");
            if (effects && effects.numProperties > 0) {
                for (var j = 1; j <= effects.numProperties; j++) {
                    var effect = effects.property(j);
                    if (effect) {
                        var effectName = effect.name;
                        var matchName = effect.matchName;

                        // Store as JSON string to ensure uniqueness
                        var key = matchName + "|" + effectName;
                        if (!pluginSet[key]) {
                            pluginSet[key] = {
                                name: effectName,
                                matchName: matchName
                            };
                        }
                    }
                }
            }
        } catch (e) {
            // Skip if can't read effects
        }

        // If it's a precomp, recurse into it
        if (layer instanceof AVLayer && layer.source instanceof CompItem) {
            _scanPluginsRecursive(layer.source, visitedComps, pluginSet);
        }
    }
}

/**
 * Collects all unique plugins/effects from main composition and sections
 * IMPORTANT: Returns ONLY third-party plugins (excludes built-in Adobe effects)
 * @param {CompItem} mainComp - Main composition
 * @param {Object} sectionComps - Object with hook/body/cta section data
 * @returns {Array<object>} Sorted array of unique third-party plugins
 */
function _collectAllPlugins(mainComp, sectionComps) {
    var pluginSet = {};
    var visitedComps = {};

    // Scan main composition
    _scanPluginsRecursive(mainComp, visitedComps, pluginSet);

    // Scan section compositions
    var sectionKeys = ["hook", "body", "cta"];
    for (var i = 0; i < sectionKeys.length; i++) {
        var sectionKey = sectionKeys[i];
        if (sectionComps[sectionKey] && sectionComps[sectionKey].comp) {
            _scanPluginsRecursive(sectionComps[sectionKey].comp, visitedComps, pluginSet);
        }
    }

    // List of built-in plugin prefixes
    var builtInPrefixes = [
        "ADBE",           // Adobe native effects
        "Pseudo/",        // Essential Graphics controls & animation presets
        "CC ",            // Cycore FX bundled
        "CS ",            // Creative Suite/Cloud bundled
        "APC ",           // Additional Plugin Set bundled
        "VISINF ",        // Vision effects bundled
        "ISL ",           // Mocha integration bundled
        "SYNTHAP ",       // Synthetic Aperture bundled
        "Keylight"        // Keylight bundled (The Foundry)
    ];

    // Helper function to check if plugin is built-in
    function isBuiltIn(matchName) {
        for (var i = 0; i < builtInPrefixes.length; i++) {
            if (matchName.indexOf(builtInPrefixes[i]) === 0) {
                return true;
            }
        }
        return false;
    }

    // Convert set to sorted array
    // FILTER: Exclude ALL built-in plugins
    var plugins = [];
    for (var key in pluginSet) {
        if (pluginSet.hasOwnProperty(key)) {
            var plugin = pluginSet[key];
            // Show ONLY third-party plugins
            if (!isBuiltIn(plugin.matchName)) {
                plugins.push(plugin);
            }
        }
    }

    // Sort by name
    plugins.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    return plugins;
}
