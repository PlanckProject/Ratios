# Ratios

Ratios is a lightweight React Native collage editor for iOS and Android. It uses Expo and stores every project and reusable template as a versioned JSON document.

## Run locally

```powershell
yarn install
yarn android
```

Use `yarn ios` on macOS for the iOS simulator. Ratios uses a small native view recorder for high-resolution image and video output, so it requires a development/native build and does not run in Expo Go. After installing a development build, use `yarn start` to reconnect it to Metro.

For static TypeScript checks without building the app, use `yarn typecheck`.

## Editor capabilities

- Multiple image and video layers with multi-select import, free movement, resize, crop position,
  zoom, flip, rotation, fit, and frame ratio controls; selection outlines follow live transforms
- Optional snapping aligns layer edges and centers to the page and other visible layers; grid and
  safe-area overlays remain visual guides and never block overlapping layers
- Multi-page projects with shared coordinates: layers may cross page boundaries and are clipped
  into the correct portion of each exported image or video; selection follows cross-page drags
- Page delete controls sit directly above the canvas and remain accessible when zoomed
- Text layers with style, alignment, color, and lightweight fade, rise, pulse, and typewriter animations
- Shape and grid layers
- Layer visibility, locking, duplication, deletion, and front/back ordering
- `3:4`, `4:5`, `9:16`, `3:2`, and `1:1` canvases
- Undo and redo for document edits
- Device-local project persistence
- Visible Delete actions on Home and Projects cards, with confirmation; More retains duplicate
  and JSON export actions
- Full-bleed built-in templates with edge-to-edge panes and no decorative borders or captions;
  Gallery is a nine-photo layout without simulated phone controls
- Lossless PNG and hardware-encoded H.264 exports
- Standard `1080 px` and Max `2160 px` width presets, with Max selected by default

The editor mounts only the active tool sheet and the layers relevant to each page. Gesture
responders are created only for the selected, unlocked layer, and unchanged saves are skipped.
Template IDs, page counts, and aspect ratios are preserved; existing saved designs are unchanged.

Export height is derived from the active ratio:

| Ratio | Standard | Max |
|---|---:|---:|
| `3:4` | `1080 × 1440` | `2160 × 2880` |
| `4:5` | `1080 × 1350` | `2160 × 2700` |
| `9:16` | `1080 × 1920` | `2160 × 3840` |
| `3:2` | `1080 × 720` | `2160 × 1440` |
| `1:1` | `1080 × 1080` | `2160 × 2160` |

## JSON documents

Projects and templates use the same schema. The `documentType` field is either `collage-project` or `collage-template`. Exports contain the complete normalized document, including canvas settings, requirements, layers, transforms, timing, playback, text style, animations, guides, and metadata.

Imports may be compact. Missing optional properties receive safe defaults, while malformed values, duplicate layer IDs, unsupported ratios, and unknown layer types are rejected. See `examples\minimal-template.ratios.json`.

Project JSON preserves references to media stored by Ratios on the current device. Template export removes device-local media while retaining media slots, layout, styles, and requirements so the design can be reused or shared.

## Remote template repository

Set `EXPO_PUBLIC_TEMPLATE_REPOSITORY_URL` or configure the URL in the app. The URL can point directly to a template JSON file or to a directory containing `index.json`.

```json
{
  "schemaVersion": 1,
  "name": "My Ratios templates",
  "templates": [
    "portrait.ratios.json",
    "story.ratios.json"
  ]
}
```

Manifest entries may also contain inline template objects. Relative file paths are resolved against the manifest URL.
