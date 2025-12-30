/**
 * generateConfig.jsx
 * Generates config.json for selected composition and saves it next to project file
 *
 * This script is meant to be called from automatedRenderCollect.jsx workflow
 * or standalone for testing
 *
 * IMPORTANT: This script expects the following to be already loaded:
 * - libs/polyfills.jsx
 * - libs/json2.jsx
 * - scanCompositionConfig.jsx
 */

// Load dependencies only if running standalone
if (typeof GENERATE_CONFIG_STANDALONE !== 'undefined' && GENERATE_CONFIG_STANDALONE) {
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;
    $.evalFile(scriptFolder.fsName + "/libs/polyfills.jsx");
    $.evalFile(scriptFolder.fsName + "/libs/json2.jsx");
    $.evalFile(scriptFolder.fsName + "/scanCompositionConfig.jsx");
}

/**
 * Generate and save config.json for currently selected composition
 * @param {string} saveFolder - Optional folder path to save config.json (defaults to project folder)
 * @param {CompItem} [compItem] - Optional: composition to scan. If not provided, uses project selection
 * @returns {string} JSON result with success/error
 */
function generateConfigJSON(saveFolder, compItem) {
    try {
        var project = app.project;

        if (!project || !project.file) {
            return JSON.stringify({
                success: false,
                error: "Project not saved"
            });
        }

        // Run the composition scanner (pass compItem if provided)
        var scanResultJSON = scanCompositionConfig(compItem);
        var scanResult = JSON.parse(scanResultJSON);

        if (scanResult.error) {
            return JSON.stringify({
                success: false,
                error: scanResult.error
            });
        }

        if (!scanResult.success) {
            return JSON.stringify({
                success: false,
                error: "Scan failed"
            });
        }

        // Determine save location
        var targetFolder;
        if (saveFolder) {
            targetFolder = new Folder(saveFolder);
        } else {
            targetFolder = project.file.parent;
        }

        // Save config.json
        var configFile = new File(targetFolder.fsName + "/config.json");
        configFile.encoding = "UTF-8";

        if (!configFile.open("w")) {
            return JSON.stringify({
                success: false,
                error: "Could not open file for writing: " + configFile.fsName
            });
        }

        configFile.write(JSON.stringify(scanResult.config, null, 2));
        configFile.close();

        return JSON.stringify({
            success: true,
            configPath: configFile.fsName,
            compositionName: scanResult.config.compositionName
        });

    } catch (e) {
        return JSON.stringify({
            success: false,
            error: e.toString() + " (Line: " + e.line + ")"
        });
    }
}

// If run standalone (for testing)
if (typeof GENERATE_CONFIG_STANDALONE !== 'undefined' && GENERATE_CONFIG_STANDALONE) {
    var result = generateConfigJSON();
    alert(result);
}
