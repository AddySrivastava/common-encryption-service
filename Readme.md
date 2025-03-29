# MongoDB Field Encryption Service

This is a Node.js service that provides encryption and decryption of MongoDB fields using Client-Side Field Level Encryption (CSFLE). The service uses a local Key Management System (KMS) provider to generate and store encryption keys.

## Features
- Encrypts field values using a per-collection data key.
- Decrypts encrypted field values.
- Automatically generates and manages encryption keys for different collections.

## Prerequisites
- Node.js (v14+ recommended)
- MongoDB 4.2+ with the `mongocryptd` process enabled (for Client-Side Field Level Encryption)
- A MongoDB connection URI

## Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <repository-folder>
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Update the MongoDB connection URI in the `uri` variable inside `index.js`.

## Usage

### Start the Service
```sh
node index.js
```
The service will start on port `3030`.

### API Endpoints

#### Encrypt Data
- **Endpoint:** `POST /encrypt`
- **Description:** Encrypts specified fields for a given namespace (collection name).
- **Request Body:**
  ```json
  {
    "namespace": "your_collection_name",
    "fieldNameArrayMap": {
      "field1": "value1",
      "field2": "value2"
    }
  }
  ```
- **Response:**
  ```json
  {
    "namespace": "your_collection_name",
    "encryptedData": {
      "field1": "<encrypted_value>",
      "field2": "<encrypted_value>"
    }
  }
  ```

#### Decrypt Data
- **Endpoint:** `POST /decrypt`
- **Description:** Decrypts previously encrypted field values.
- **Request Body:**
  ```json
  {
    "namespace": "your_collection_name",
    "fieldNameArrayMap": {
      "field1": "<encrypted_value>",
      "field2": "<encrypted_value>"
    }
  }
  ```
- **Response:**
  ```json
  {
    "namespace": "your_collection_name",
    "decryptedData": {
      "field1": "value1",
      "field2": "value2"
    }
  }
  ```

## Key Management
- The encryption keys are stored in the `keyvault.datakeys` collection in MongoDB.
- A master key (96 bytes) is required and stored locally in `master-key.txt`.
- If the master key file does not exist, the service generates a new one automatically.

## Troubleshooting
- Ensure that MongoDB is running and accessible with the provided connection URI.
- If the encryption process fails, check that the MongoDB version supports Client-Side Field Level Encryption.

