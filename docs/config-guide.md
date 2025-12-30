# Composition Config Documentation

Повна документація для `config.json` структури, що генерується скриптом `scanCompositionConfig.jsx`.

## Зміст

1. [Огляд структури](#огляд-структури)
2. [Формати Voiceover](#формати-voiceover)
3. [Секції (Hook/Body/CTA)](#секції-hookbodycta)
4. [Music](#music)
5. [Footages](#footages)
6. [Subtitles](#subtitles)
7. [Text Boxes](#text-boxes)
8. [Нюанси та Edge Cases](#нюанси-та-edge-cases)

---

## Огляд структури

```json
{
  "compositionName": "MainComposition_recXXXXXXXXXXXXXX_en",
  "Hook": { /* Section */ },
  "Body": { /* Section */ },
  "CTA": { /* Section */ },
  "music": { /* Music */ }
}
```

### Ключові поля:

- **`compositionName`**: Назва основної композиції
- **`Hook`/`Body`/`CTA`**: Секції композиції (можуть бути `null` якщо не знайдені)
- **`music`**: Один музичний шар (може бути `null`)

---

## Формати Voiceover

Існує **два основні формати** voiceover файлів, які парсяться по-різному.

### 1. Формат "Voiceover"

**Шаблон назви файлу:**
```
Voiceover_{VoiceName}_{VoiceID}_{Timestamp}.mp3
```

**Приклад:**
```
Voiceover_Jessica_cgSgspJ2msm6clMCkdW9_1764272135889.mp3
```

**Результат парсингу:**
```json
{
  "sourceName": "Voiceover_Jessica_cgSgspJ2msm6clMCkdW9_1764272135889.mp3",
  "layerName": "Voiceover_Jessica_cgSgspJ2msm6clMCkdW9_1764272135889.mp3",
  "voiceName": "Jessica",
  "voiceID": "cgSgspJ2msm6clMCkdW9",
  "format": "Voiceover",
  "isSanitized": false,
  "cloneType": null
}
```

**Особливості:**
- ✅ Має `voiceID` (20 символів, alphanumeric)
- ❌ `cloneType` завжди `null`
- ❌ `isSanitized` завжди `false`
- Парсинг: перша частина = "Voiceover", друга = voiceName, третя = voiceID (якщо 20 символів)

---

### 2. Формат "ElevenLabs"

**Шаблон назви файлу:**
```
ElevenLabs_{Timestamp}_{VoiceName}_{CloneType}_{Parameters}.mp3
```

**Приклад:**
```
ElevenLabs_2025-12-30T17_18_06_Roger - Laid-Back, Casual, Resonant_pre_sp100_s50_sb75_se0_b_m2.mp3
```

**Результат парсингу:**
```json
{
  "sourceName": "ElevenLabs_2025-12-30T17_18_06_Roger - Laid-Back, Casual, Resonant_pre_sp100_s50_sb75_se0_b_m2.mp3",
  "layerName": "ElevenLabs_2025-12-30T17_18_06_Roger - Laid-Back, Casual, Resonant_pre_sp100_s50_sb75_se0_b_m2.mp3",
  "voiceName": "Roger - Laid-Back, Casual, Resonant",
  "voiceID": null,
  "format": "ElevenLabs",
  "isSanitized": false,
  "cloneType": "pre"
}
```

**Особливості:**
- ❌ `voiceID` завжди `null` (ElevenLabs не використовує 20-char ID)
- ✅ Має `cloneType` (наприклад: `"pre"`, `"ivc"`, тощо)
- ❌ `isSanitized` завжди `false`
- Парсинг: parts[4] = voiceName, parts[5] = cloneType
- Timestamp формат: `2025-12-30T17_18_06` (parts[1-3])

---

### 3. Формат "11labs" (sanitized)

**Шаблон назви файлу:**
```
11labs_{Sanitized__VoiceName}_{VoiceID_or_Timestamp}
```

**Особливості:**
- ✅ `isSanitized` = `true` (завжди)
- Може мати `voiceID` (якщо остання частина = 20 символів) або timestamp
- Використовується для sanitized voice names

---

### Порівняльна таблиця форматів

| Поле | Voiceover | ElevenLabs | 11labs |
|------|-----------|------------|--------|
| `voiceID` | ✅ 20-char string | ❌ null | ⚠️ optional |
| `cloneType` | ❌ null | ✅ string | ❌ null |
| `isSanitized` | ❌ false | ❌ false | ✅ true |
| `format` | "Voiceover" | "ElevenLabs" | "11labs" |

---

## Секції (Hook/Body/CTA)

Кожна секція має однакову структуру:

```json
{
  "compositionName": "Hook_recXXXXXXXXXXXXXX",
  "voice": { /* Voice object or null */ },
  "subtitles": { /* Subtitles object or null */ },
  "textBoxes": { /* TextBoxes object or null */ },
  "footages": [ /* Array of Footage objects */ ]
}
```

### Як знаходяться секції?

Скрипт шукає sub-compositions в main composition з назвами:
- **Exact match** (пріоритет): "hook", "body", "cta" (lowercase)
- **Partial match** (fallback): містить "hook", "body", або "cta"

**Приклад:**
```
Main Composition
  └── Hook (sub-comp) ✅ знайдено як Hook
  └── Body_Scene1 (sub-comp) ✅ знайдено як Body (partial match)
  └── cta (sub-comp) ✅ знайдено як CTA
```

### Null секції

Якщо секція не знайдена:
```json
{
  "Hook": null,
  "Body": { /* ... */ },
  "CTA": { /* ... */ }
}
```

---

## Music

Музика - це **один аудіо шар** з main composition (не масив!).

### Логіка вибору музики:

**Пріоритет 1:** Шар з назвою `Music_*` або `music_*`
```
Music_background.mp3 ✅ обрано (пріоритет)
SFX_whoosh.mp3 ❌ ігнорується
```

**Пріоритет 2:** Найдовший аудіо шар
```
ambient.mp3 (duration: 30s) ✅ обрано (найдовший)
intro.mp3 (duration: 5s) ❌ не обрано
```

### Виключення:

Аудіо шари які **не** можуть бути музикою:
- ❌ Починається з `Voiceover_`
- ❌ Починається з `ElevenLabs_`
- ❌ Починається з `11labs_`
- ❌ Починається з `SFX_`

### Приклад:

```json
{
  "music": {
    "layerName": "Music_background.mp3",
    "layerIndex": 5,
    "sourceName": "background_music.mp3",
    "inPoint": 0,
    "outPoint": 30,
    "duration": 30,
    "enabled": true,
    "audioLevels": {
      "value": [-20],
      "isAnimated": false,
      "numKeys": 0
    }
  }
}
```

### Null music:

Якщо немає підходящих аудіо шарів:
```json
{
  "music": null
}
```

---

## Footages

Footages - це **масив відео файлів** у секції (Hook/Body/CTA).

### Правила включення:

✅ **Включаються:**
- Тільки `.mp4` та `.mov` файли
- AVLayer з реальним файлом (не solid, не precomp)
- Enabled або disabled (поле `enabled` вказує статус)

❌ **Виключаються:**
- Text layers
- Shape layers
- Adjustment layers
- Camera/Light layers
- Voiceover файли (містять `elevenlabs_`, `11labs_`, `voiceover_`)
- Precompositions
- Інші формати (не .mp4/.mov)

### Сортування:

Footages сортуються по **`inPoint`** (від раннього до пізнього) і отримують **`order`** 1, 2, 3...

### Приклад:

```json
{
  "footages": [
    {
      "layerName": "Footage_Part1.mp4",
      "sourceName": "Footage_Part1.mp4",
      "inPoint": 0,
      "outPoint": 2.433,
      "duration": 2.433,
      "enabled": true,
      "order": 1
    },
    {
      "layerName": "Footage_Part2.mp4",
      "sourceName": "Footage_Part2.mp4",
      "inPoint": 2.433,
      "outPoint": 5.36,
      "duration": 2.927,
      "enabled": true,
      "order": 2
    }
  ]
}
```

### Порожній масив:

Якщо немає footages:
```json
{
  "footages": []
}
```

---

## Subtitles

Subtitles - це **перший text layer** знайдений у секції.

### Структура:

```json
{
  "subtitles": {
    "fontName": "Arial",
    "fontSize": 48,
    "fillColor": [1, 1, 1],
    "strokeColor": [0, 0, 0],
    "strokeWidth": 2,
    "applyStroke": true,
    "fontCapsOption": "All Caps",
    "tracking": 0,
    "leading": null,
    "autoLeading": true,
    "numLines": 2,
    "maxChars": 30,
    "wordCount": 8,
    "transform": {
      "position": [960, 540],
      "scale": [100, 100],
      "rotation": 0,
      "opacity": 100,
      "anchorPoint": [0, 0]
    }
  }
}
```

### Кольори:

- **RGB формат**: `[R, G, B]` у діапазоні **0-255**
- `fillColor`: колір тексту
- `strokeColor`: колір обводки

**Приклад:**
- Білий: `[255, 255, 255]`
- Чорний: `[0, 0, 0]`
- Червоний: `[255, 0, 0]`

### Leading:

- `leading`: відстань між рядками (number або `null`)
- `autoLeading`: `true` якщо auto, тоді `leading` = `null`

### Transform:

Кожна властивість transform має структуру з анімацією:

```json
{
  "position": {
    "value": [540, 1122, 0],
    "isAnimated": false,
    "numKeys": 0
  },
  "scale": {
    "value": [100, 100, 100],
    "isAnimated": false,
    "numKeys": 0
  },
  "rotation": {
    "value": 0,
    "isAnimated": false,
    "numKeys": 0
  },
  "opacity": {
    "value": 100,
    "isAnimated": false,
    "numKeys": 0
  },
  "anchorPoint": {
    "value": [0, 0, 0],
    "isAnimated": false,
    "numKeys": 0
  }
}
```

- `value`: значення властивості (масив для position/scale/anchorPoint, число для rotation/opacity)
- `isAnimated`: чи є keyframes
- `numKeys`: кількість keyframes (0 якщо не анімовано)

---

## Text Boxes

Text boxes - це **control layers** для динамічних текстових параметрів.

### Типи:

- **Accent** - accent box control
- **Adaptive** - adaptive box control
- **Text** - text box control

### Структура:

```json
{
  "textBoxes": {
    "boxType": "Adaptive",
    "layerName": "Adaptive Box Control",
    "parameters": {
      "Roundness": {
        "type": "Slider",
        "value": 10
      },
      "Size X": {
        "type": "Slider",
        "value": 0
      },
      "Color": {
        "type": "Color",
        "value": [2, 2, 2]
      },
      "Opacity": {
        "type": "Slider",
        "value": 100
      }
    }
  }
}
```

**Типи параметрів:**
- `Slider`: числове значення
- `Color`: RGB масив [R, G, B]
- `Checkbox`: boolean значення
- `Point`: координати [x, y]

### Пріоритет пошуку:

1. Шукає adjustment layer з назвою: `"accent box control"`, `"adaptive box control"`, `"text box control"`
2. Якщо не знайдено, шукає shape layer: `"box_accent"`, `"box_adaptive"`, `"box_text"`

---

## Нюанси та Edge Cases

### 1. Timeline positions (inPoint/outPoint/duration)

**Важливо:** Всі часові значення відносно **композиції**, не source файлу!

```json
{
  "inPoint": 5,      // Шар починається на 5 секунді таймлайну
  "outPoint": 10,    // Шар закінчується на 10 секунді таймлайну
  "duration": 5      // Тривалість = outPoint - inPoint
}
```

Якщо ви розрізали шар в AE:
```
Original layer: 0-10s → Split at 5s
Part 1: inPoint: 0, outPoint: 5, duration: 5
Part 2: inPoint: 5, outPoint: 10, duration: 5
```

### 2. Розрізані footage layers

Якщо один footage розрізано на дві частини, обидві будуть в масиві:

```json
{
  "footages": [
    {
      "layerName": "Footage_HookPart.mp4",
      "sourceName": "Footage_HookPart.mp4",
      "inPoint": 0,
      "outPoint": 2.433,
      "duration": 2.433,
      "order": 1
    },
    {
      "layerName": "Footage_HookPart.mp4",  // Той самий source!
      "sourceName": "Footage_HookPart.mp4",
      "inPoint": 2.433,
      "outPoint": 5.36,
      "duration": 2.927,
      "order": 2
    }
  ]
}
```

**Примітка:** `sourceName` буде однаковий, але `inPoint`/`outPoint` різні.

### 3. Disabled layers

Disabled layers **включаються** в config з `enabled: false`:

```json
{
  "layerName": "Old_footage.mp4",
  "enabled": false,  // Layer is disabled in AE
  "order": 3
}
```

### 4. Music якщо є кілька Music_ шарів

Якщо є кілька `Music_*` шарів, береться **перший знайдений**:

```
Music_background.mp3 (layer 5) ✅ обрано (перший)
Music_intro.mp3 (layer 10) ❌ ігноровано
```

### 5. Voice parsing fallback

Якщо `sourceName` не парситься, скрипт пробує `layerName`:

```javascript
// Спочатку пробує sourceName
var parsed = _parseVoiceoverName(sourceName);

// Якщо не спрацювало, пробує layerName
if (parsed.format === "unknown") {
  parsed = _parseVoiceoverName(layerName);
}
```

### 6. Null vs Empty Array

- **Sections (Hook/Body/CTA)**: можуть бути `null`
- **Footages**: завжди масив (може бути `[]`)
- **Music**: може бути `null`
- **Voice/Subtitles/TextBoxes**: можуть бути `null`

**Приклад:**
```json
{
  "Hook": null,           // Секція не знайдена
  "Body": {
    "voice": null,        // Voiceover не знайдено
    "footages": []        // Порожній масив (не null!)
  },
  "music": null           // Музика не знайдена
}
```

### 7. AudioLevels може бути null

```json
{
  "audioLevels": null  // Якщо не вдалось отримати
}
```

Або:
```json
{
  "audioLevels": {
    "value": [-20],
    "isAnimated": false,
    "numKeys": 0
  }
}
```

### 8. Composition naming patterns

Composition names часто містять Airtable ID:

```
MainComp_recXXXXXXXXXXXXXX_en_reelver-2
Hook_recXXXXXXXXXXXXXX
```

Де:
- `recXXXXXXXXXXXXXX` - 14-character Airtable record ID
- `en` - мова
- `reelver-2` - версія

---

## Повний приклад config.json

Повний реальний приклад config.json знаходиться в файлі: **[`config-example-full.json`](./config-example-full.json)**

**Особливості цього прикладу:**
- ✅ Всі три секції: Hook, Body, CTA
- ✅ Два формати voiceover: Voiceover (Hook/Body) і ElevenLabs (CTA)
- ✅ Реальні футажі з довгими назвами
- ✅ Transform з анімаційними даними
- ✅ TextBoxes з параметрами
- ✅ Music layer з audioLevels
- ✅ Розрізаний footage (Hook має 2 частини одного файлу)
- ✅ Body має 10 різних footage layers

**Короткий огляд структури:**

```json
{
  "compositionName": "Main_Composition",
  "Hook": {
    "voice": { "format": "Voiceover", "voiceID": "cgSgspJ2msm6clMCkdW9" },
    "subtitles": { "fontName": "AlbertSansRoman-Bold", "fontSize": 55 },
    "textBoxes": { "boxType": "Adaptive", "parameters": {...} },
    "footages": [2 items]
  },
  "Body": {
    "voice": { "format": "Voiceover", "voiceID": "cgSgspJ2msm6clMCkdW9" },
    "subtitles": { "fontName": "AlbertSansRoman-Bold", "fontSize": 55 },
    "textBoxes": { "boxType": "Adaptive", "parameters": {...} },
    "footages": [10 items]
  },
  "CTA": {
    "voice": { "format": "ElevenLabs", "voiceID": null, "cloneType": "pre" },
    "subtitles": { "fontName": "Poppins-Bold", "fontSize": 69 },
    "textBoxes": null,
    "footages": [1 item]
  },
  "music": {
    "layerName": "ES_Wishful Thinking - Phello.mp3",
    "duration": 31.4,
    "audioLevels": { "value": [-20, -20], "isAnimated": false }
  }
}
```

---

## Changelog

### 2025-12-30
- Змінено `music` з масиву на один об'єкт
- Додано smart music selection (пріоритет Music_ префікс, потім найдовший)
- Виключено Voiceover_, ElevenLabs_, 11labs_, SFX_ з музики
- Прибрано `filePath` з music
- Прибрано `startTime` з footages
- Створено документацію з JSON Schema

---

## Використання JSON Schema

Для валідації config.json:

```bash
# Використання ajv-cli
npm install -g ajv-cli
ajv validate -s docs/config-schema.json -d path/to/config.json
```

```javascript
// Використання в Node.js
const Ajv = require('ajv');
const schema = require('./docs/config-schema.json');
const config = require('./path/to/config.json');

const ajv = new Ajv();
const validate = ajv.compile(schema);
const valid = validate(config);

if (!valid) {
  console.log(validate.errors);
}
```
