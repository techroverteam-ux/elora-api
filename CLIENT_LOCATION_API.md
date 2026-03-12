# Client Location Configuration API

## Overview
The Client Location Configuration API allows you to manage GPS location overlay settings for each client. When enabled, photos taken during recce and installation will automatically include GPS location information embedded directly in the image.

## Endpoints

### 1. Get Client Location Configuration
**GET** `/api/clients/:id/location-config`

Retrieves the location configuration for a specific client.

#### Parameters
- `id` (string, required): Client ID

#### Response
```json
{
  "locationConfig": {
    "enableLocationOverlay": false,
    "showAddress": true,
    "showCoordinates": true,
    "showTimestamp": true,
    "mapSize": 80,
    "position": "bottom-left"
  }
}
```

#### Example
```bash
curl -X GET "https://api.example.com/api/clients/64a1b2c3d4e5f6789012345/location-config" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Update Client Location Configuration
**PUT** `/api/clients/:id/location-config`

Updates the location configuration for a specific client.

#### Parameters
- `id` (string, required): Client ID

#### Request Body
```json
{
  "locationConfig": {
    "enableLocationOverlay": true,
    "showAddress": true,
    "showCoordinates": true,
    "showTimestamp": true,
    "mapSize": 80,
    "position": "bottom-left"
  }
}
```

#### Response
```json
{
  "message": "Location configuration updated successfully",
  "locationConfig": {
    "enableLocationOverlay": true,
    "showAddress": true,
    "showCoordinates": true,
    "showTimestamp": true,
    "mapSize": 80,
    "position": "bottom-left"
  }
}
```

#### Example
```bash
curl -X PUT "https://api.example.com/api/clients/64a1b2c3d4e5f6789012345/location-config" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationConfig": {
      "enableLocationOverlay": true,
      "showAddress": true,
      "showCoordinates": true,
      "showTimestamp": true,
      "mapSize": 80,
      "position": "bottom-left"
    }
  }'
```

### 3. Create Client (Updated)
**POST** `/api/clients`

Creates a new client with optional location configuration.

#### Request Body
```json
{
  "clientName": "Example Corp",
  "branchName": "Main Branch",
  "gstNumber": "22AAAAA0000A1Z5",
  "elements": [
    {
      "elementId": "64a1b2c3d4e5f6789012345",
      "elementName": "LED Display",
      "customRate": 150,
      "quantity": 1
    }
  ],
  "locationConfig": {
    "enableLocationOverlay": true,
    "showAddress": true,
    "showCoordinates": true,
    "showTimestamp": true,
    "mapSize": 80,
    "position": "bottom-left"
  }
}
```

### 4. Update Client (Updated)
**PUT** `/api/clients/:id`

Updates an existing client including location configuration.

#### Request Body
```json
{
  "clientName": "Example Corp Updated",
  "branchName": "Main Branch",
  "gstNumber": "22AAAAA0000A1Z5",
  "elements": [...],
  "locationConfig": {
    "enableLocationOverlay": false,
    "showAddress": true,
    "showCoordinates": true,
    "showTimestamp": true,
    "mapSize": 80,
    "position": "bottom-left"
  }
}
```

## Location Configuration Schema

### LocationConfig Object
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enableLocationOverlay` | boolean | Yes | false | Enable/disable GPS location overlay on photos |
| `showAddress` | boolean | No | true | Show reverse geocoded address in overlay |
| `showCoordinates` | boolean | No | true | Show latitude/longitude coordinates |
| `showTimestamp` | boolean | No | true | Show photo capture timestamp |
| `mapSize` | number | No | 80 | Size of map preview in pixels (60-120) |
| `position` | string | No | "bottom-left" | Overlay position on image |

### Position Options
- `"bottom-left"` - Bottom left corner
- `"bottom-right"` - Bottom right corner  
- `"top-left"` - Top left corner
- `"top-right"` - Top right corner

### Map Size Constraints
- Minimum: 60 pixels
- Maximum: 120 pixels
- Default: 80 pixels

## Error Responses

### 400 Bad Request
```json
{
  "message": "Location configuration is required"
}
```

### 404 Not Found
```json
{
  "message": "Client not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error message"
}
```

## Usage Examples

### Enable GPS Location for Client
```javascript
const response = await fetch('/api/clients/64a1b2c3d4e5f6789012345/location-config', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    locationConfig: {
      enableLocationOverlay: true,
      showAddress: true,
      showCoordinates: true,
      showTimestamp: true,
      mapSize: 80,
      position: 'bottom-left'
    }
  })
});
```

### Disable GPS Location for Client
```javascript
const response = await fetch('/api/clients/64a1b2c3d4e5f6789012345/location-config', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    locationConfig: {
      enableLocationOverlay: false
    }
  })
});
```

### Check Client Location Configuration
```javascript
const response = await fetch('/api/clients/64a1b2c3d4e5f6789012345/location-config', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const { locationConfig } = await response.json();
console.log('GPS enabled:', locationConfig.enableLocationOverlay);
```

## Migration

### Database Migration
After deploying the updated client model, run the migration script to add default location configuration to existing clients:

```bash
npm run migrate:client-location-config
```

Or run directly:
```bash
npx ts-node src/scripts/migrateClientLocationConfig.ts
```

### Default Configuration
All existing clients will be migrated with the following default configuration:
```json
{
  "enableLocationOverlay": false,
  "showAddress": true,
  "showCoordinates": true,
  "showTimestamp": true,
  "mapSize": 80,
  "position": "bottom-left"
}
```

## Integration Notes

### Mobile App Integration
The mobile app automatically checks the client's location configuration when taking photos:

1. **Client Check**: App fetches location config for the current client
2. **Permission Request**: If enabled, app requests GPS permissions
3. **Location Capture**: GPS location is captured when photo is taken
4. **Overlay Generation**: Location overlay is embedded in the final image
5. **Upload**: Image with embedded location data is uploaded to server

### Privacy Considerations
- Location data is only captured when explicitly enabled for a client
- GPS coordinates are embedded directly in the image file
- No separate location tracking or storage occurs
- Users can see GPS indicator when location overlay is active

## Testing

### Test Location Configuration
```bash
# Enable location overlay
curl -X PUT "http://localhost:5000/api/clients/CLIENT_ID/location-config" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationConfig": {"enableLocationOverlay": true}}'

# Check configuration
curl -X GET "http://localhost:5000/api/clients/CLIENT_ID/location-config" \
  -H "Authorization: Bearer TOKEN"
```

### Verify Migration
```bash
# Check if all clients have location config
curl -X GET "http://localhost:5000/api/clients" \
  -H "Authorization: Bearer TOKEN" | jq '.clients[] | {id: ._id, hasLocationConfig: (.locationConfig != null)}'
```