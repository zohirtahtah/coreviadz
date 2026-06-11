# Upload API Documentation - Corevia DZ

## Overview

Corevia DZ handles file uploads entirely on the client side using **base64 encoding**. There is no dedicated upload server. Files are stored in `localStorage` and optionally synced to Supabase (database only — no Supabase Storage buckets are used).

| Upload Type | Format | Max Size (practical) | Storage Target |
|---|---|---|---|
| Logo Image | base64 data URL | ~1-2 MB | `BusinessProfile.logoUrl` (localStorage & Supabase `corevia_profile`) |
| Voice Recording | base64 audio/webm | ~500 KB | `ChatMessage.voiceUrl` (localStorage & Supabase `corevia_chat_messages`) |
| Business Data | JSON | Unlimited | Supabase tables via REST API |

---

## 1. Logo Upload

### Endpoint (Internal)
```
Function: handleLogoUpload(e: ChangeEvent<HTMLInputElement>) → void
```

### Request
| Field | Type | Description |
|---|---|---|
| `file` | `File` | Image file from `<input type="file" accept="image/*">` |

### Process Flow
```
Input File → FileReader.readAsDataURL() → base64 string → BusinessProfile.logoUrl (localStorage)
                                                                        ↓
                                                          supabaseSync.pushFullTenantData()
                                                                        ↓
                                                          Supabase corevia_profile.logo_url
```

### Source Locations
| Location | Lines |
|---|---|
| `src/components/Onboarding.tsx` | 54–65 |
| `src/components/SettingsView.tsx` | 822–838 |

### Code Pattern
```typescript
const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string; // "data:image/png;base64,iVBOR..."
      setLogoPreview(resultString);
      setLogoUrl(resultString);
    };
    reader.readAsDataURL(file);
  }
};
```

### Response (Example)
```json
{
  "logoUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Storage Schema
| Field | Type | Table |
|---|---|---|
| `logoUrl` | `string \| undefined` | `BusinessProfile` (localStorage key: `corevia_business_profile_v1_{tenant}`) |
| `logo_url` | `text \| null` | `corevia_profile` (Supabase) |

### Display Locations
- `src/components/Sidebar.tsx:273–287` — Brand card logo
- `src/components/OrdersView.tsx:847–858` — Invoice print template (`<img src="${profile.logoUrl}">`)

### Validation & Constraints
- No file size validation
- No file type validation (accepts any image/*)
- No compression
- No image dimension limits
- Single file only

---

## 2. Voice Recording Upload

### Endpoint (Internal)
```
Function: startRecording() → Promise<void>
Function: stopRecording() → Promise<string> (base64 audio)
```

### Process Flow
```
getUserMedia({ audio: true }) → MediaRecorder → Blob[] chunks
                                                       ↓
                                          FileReader.readAsDataURL(audioBlob)
                                                       ↓
                                          base64 string → ChatMessage.voiceUrl
                                                       ↓
                                          localStorage + Supabase corevia_chat_messages
```

### Source Location
| Location | Lines |
|---|---|
| `src/components/CommunicationView.tsx` | 128–202 |

### Recording Start
```typescript
// Request microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
mediaRecorder.start();
```

### Recording Stop
```typescript
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(chunks, { type: "audio/webm" });
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Audio = reader.result as string;
    await sendChatMessage({
      companyId,
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      message: "",
      messageType: "voice",
      voiceUrl: base64Audio,
      createdAt: new Date().toISOString(),
      readBy: [userId],
    });
  };
  reader.readAsDataURL(audioBlob);
};
```

### Response (Example)
```json
{
  "voiceUrl": "data:audio/webm;base64,GkXfo09uYW1lVl9B...",
  "duration": 5432
}
```

### Storage Schema (ChatMessage)
| Field | Type | Source |
|---|---|---|
| `voiceUrl` | `string \| undefined` | localStorage key: `corevia_chat_messages_v1` |
| `voice_url` | `text \| null` | Supabase table: `corevia_chat_messages` |

### Playback
```typescript
// CommunicationView.tsx:406–432
if (m.voiceUrl?.includes(";base64,")) {
  <audio src={m.voiceUrl} controls />;
} else {
  // fallback waveform UI
}
```

### Fallback (No Microphone Access)
When `getUserMedia` fails, a **simulated base64 audio string** is used:
```typescript
// CommunicationView.tsx:206–256
const simulateVoiceMessage = async () => {
  const mockBase64 = "data:audio/webm;base64,GkXfo09uYW1lVl9B...";
  // sends mock voice message
};
```

### Validation & Constraints
- Requires `microphone` permission (declared in `metadata.json`)
- Audio format: `audio/webm` (browser-dependent)
- No file size limit
- No duration limit
- Mono channel (browser default)

---

## 3. Business Data Sync (Supabase Push)

### Endpoint (Internal)
```
Function: pushSingleDatasetToCloud(companyId, type, rawItems) → Promise<void>
Function: pushFullTenantData(companyId, email) → Promise<void>
```

### Source Location
| Location | Lines |
|---|---|
| `src/supabaseSync.ts` | 212–385, 666–681 |

### Supported Data Types
| Type | Supabase Table | Action |
|---|---|---|
| `products` | `corevia_products` | Delete all + insert all |
| `orders` | `corevia_orders` | Delete all + insert all |
| `suppliers` | `corevia_suppliers` | Delete all + insert all |
| `expenses` | `corevia_expenses` | Delete all + insert all |
| `workers` | `corevia_workers` | Delete all + insert all |
| `salarySheets` | `corevia_salary_sheets` | Delete all + insert all |

### Request Format
```typescript
await pushSingleDatasetToCloud(
  companyId: string,          // tenant identifier
  type: "products",           // dataset type
  rawItems: Product[]         // array of data objects
);
```

### Sync Strategy
1. **Delete all** existing rows for this company in the target table
2. **Insert all** current items from localStorage
3. Each item is serialized to match Supabase column names (snake_case)

### Orchestration
```typescript
// pushFullTenantData() calls pushSingleDatasetToCloud() for all datasets
await pushSingleDatasetToCloud(companyId, "products", products);
await pushSingleDatasetToCloud(companyId, "orders", orders);
await pushSingleDatasetToCloud(companyId, "suppliers", suppliers);
await pushSingleDatasetToCloud(companyId, "expenses", allExpenses);
await pushSingleDatasetToCloud(companyId, "workers", workers);
await pushSingleDatasetToCloud(companyId, "salarySheets", salarySheets);
```

### Triggered From
| Location | Event |
|---|---|
| `src/components/SettingsView.tsx:131` | Manual "Push to Cloud" button |
| `src/App.tsx:841–1256` | Automatic on data mutations |
| `src/components/UsersPermissionsView.tsx:282,427` | On employee/settings changes |

---

## 4. Business Data Sync (Supabase Pull)

### Endpoint (Internal)
```
Function: pullMultiTenantData(companyId) → Promise<void>
```

### Source Location
| Location | Lines |
|---|---|
| `src/supabaseSync.ts` | 391–661 |

### Process Flow
```
Supabase SELECT * FROM corevia_* WHERE company_id = {companyId}
                        ↓
            Serialize to camelCase TypeScript types
                        ↓
            Write to localStorage with tenant key
                        ↓
            window.dispatchEvent(new Event("storage"))
                        ↓
            App.tsx re-reads data via storageUtils
```

### Response (Example)
```typescript
{
  products: Product[],
  orders: Order[],
  suppliers: Supplier[],
  ...
}
```

---

## 5. Google Sheets Sync

### Endpoint (Internal)
```
Function: syncToGoogleSheets(type, data) → Promise<SyncResult>
Function: syncFromGoogleSheets(type) → Promise<DataType>
```

### Source Location
| Location | Lines |
|---|---|
| `src/googleSyncUtils.ts` | Full file (~27600 chars) |

### Supported Operations
| Direction | Description |
|---|---|
| Push | Export orders/products/workers to Google Sheets |
| Pull | Import orders/products/workers from Google Sheets |
| Bidirectional | Merge local ↔ Google Sheets data |

### OAuth Flow
1. User clicks "Connect Google Sheets" in `SheetsSyncSettings`
2. Google OAuth popup (requires `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_SECRET`)
3. Access token stored in `corevia_google_sync_tokens_v1` (localStorage)
4. Sheet ID and range stored in `corevia_google_sync_config_v1`

---

## 6. Error Handling

| Error Type | Handling |
|---|---|
| File read failure | `FileReader.onerror` — notification toast (`triggerToast("warning", ...)`) |
| Microphone denied | Fallback to simulated voice message |
| Supabase offline | Data saved locally; sync skipped silently |
| Google Sheets auth failure | Error message in SheetsSyncSettings UI |

---

## 7. Security Considerations

| Concern | Current State |
|---|---|
| File validation | None — any file type accepted for logo |
| Size limits | None — large base64 strings may exceed localStorage quota (~5-10 MB) |
| XSS via uploaded content | Potential risk — base64 data URLs rendered as `<img src>` and `<audio src>` |
| Supabase RLS | Must be disabled for anon key to push/pull data |
| Voice data privacy | Audio recordings stored as base64 in DB — no encryption |

---

## 8. Future Upload Improvements (Recommended)

| Improvement | Priority | Notes |
|---|---|---|
| Supabase Storage for logos | High | Move from base64 localStorage to `supabase.storage.from("logos").upload()` |
| Supabase Storage for voice | High | Store audio files in bucket, store URL in DB instead of base64 |
| File size validation | Medium | Reject files > 2 MB client-side |
| File type validation | Medium | Accept only `image/png`, `image/jpeg`, `image/webp` for logos |
| Image compression | Low | Resize logo to max 200x200px before encoding |
| Upload progress indicator | Low | Show progress bar during FileReader operations |

---

*Last updated: June 2026*
