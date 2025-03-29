const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient, ClientEncryption, Binary } = require("mongodb");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(bodyParser.json());
const port = 3030;

let existingKey = new Map()

// MongoDB connection URI and key vault namespace (db.collection format)
const uri = "mongodb+srv://admin:*****@uri/";
const keyVaultNamespace = "keyvault.datakeys";

// Load (or generate) the local master key (must be 96 bytes)
let masterKey;
const masterKeyPath = path.join(__dirname, "master-key.txt");

if (fs.existsSync(masterKeyPath)) {
  masterKey = fs.readFileSync(masterKeyPath);
  if (masterKey.length !== 96) {
    console.error("Master key must be 96 bytes.");
    process.exit(1);
  }
} else {
  masterKey = crypto.randomBytes(96);
  fs.writeFileSync(masterKeyPath, masterKey);
  console.log("New master key generated and saved to master-key.txt");
}

// KMS provider configuration for local keys
const kmsProviders = {
  local: { key: masterKey }
};

let mongoClient;
let clientEncryption;

// Initialize MongoDB client and the ClientEncryption instance
async function init() {
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  clientEncryption =  new ClientEncryption(mongoClient, {
    keyVaultNamespace,
    kmsProviders,
  });
}

// Utility: Get or create a data key for the collection (namespace)
async function getOrCreateDataKey(namespace) {
  // Parse keyVaultNamespace into database and collection names
  const [keyVaultDb, keyVaultColl] = keyVaultNamespace.split(".");
  const keyVault = mongoClient.db(keyVaultDb).collection(keyVaultColl);
  
  let uniqueNamespace = Symbol(namespace)

  if (existingKey.has(uniqueNamespace)) {
    return existingKey;
  }

  // Check if a key exists with keyAltNames equal to the namespace
  existingKey.set(uniqueNamespace, await keyVault.findOne({ keyAltNames: namespace }));


  // Create a new key using the local KMS provider, setting the alternate name to the namespace
  const newKeyId = await clientEncryption.createDataKey("local", { keyAltNames: [namespace] });
  
  return await keyVault.findOne({ _id: newKeyId });
}

// Encrypt endpoint – uses one key per collection (namespace) for all fields
app.post("/encrypt", async (req, res) => {
  const { namespace, fieldNameArrayMap } = req.body;
  if (!namespace || !fieldNameArrayMap) {
    return res.status(400).json({ error: "Invalid input" });
  }
  try {
    // Ensure the data key for this collection exists (or create it)
    await getOrCreateDataKey(namespace);
    
    const encryptedData = {};
    for (const [field, value] of Object.entries(fieldNameArrayMap)) {
      // Use the collection-specific key (using namespace as keyAltName)
      const encryptedValue = await clientEncryption.encrypt(value, {
        algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
        keyAltName: namespace
      });

      console.log(encryptedValue)
      encryptedData[field] = encryptedValue;
    }
    res.json({ namespace, encryptedData });
  } catch (error) {
    console.error("Encryption error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Decrypt endpoint – decrypts each provided encrypted value using the same key
app.post("/decrypt", async (req, res) => {
  const { namespace, fieldNameArrayMap } = req.body;
  if (!namespace || !fieldNameArrayMap) {
    return res.status(400).json({ error: "Invalid input" });
  }
  try {
    const decryptedData = {};
    for (const [field, encryptedValue] of Object.entries(fieldNameArrayMap)) {
      const decryptedValue = await clientEncryption.decrypt(Binary.createFromBase64(encryptedValue, 6));
      console.log(decryptedData)
      decryptedData[field] = decryptedValue;
    }
    res.json({ namespace, decryptedData });
  } catch (error) {
    console.error("Decryption error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the service after initialization
init()
  .then(() => {
    app.listen(port, () => {
      console.log(`Encryption service running on port ${port}`);
    });
  })
  .catch(err => {
    console.error("Failed to initialize encryption service:", err);
  });
