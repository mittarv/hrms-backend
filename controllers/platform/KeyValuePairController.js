const { db, } = require("../../models/index");
const { decryption, encryption } = require("../../security/encryptDecrypt");
const success = require("../../security/message");
const KeyValuePairs = db.keyValuePairs;
const CategoryKeyValue = db.categoryKeyValue;
const ShareAssets = db.shareAssets;
const { encryptAESCBCData, encryptData } = require("../../security/aesEncryption");
const {
  BlobServiceClient,
  generateAccountSASQueryParameters,
  AccountSASPermissions,
  AccountSASServices,
  AccountSASResourceTypes,
  StorageSharedKeyCredential,
  SASProtocol,
} = require("@azure/storage-blob");
const {
  removeCacheDataWhileUpdateAndCreate,
  categoryKeyValuePairsCaching,
  getAllKeyValuePairsCaching,
  getRelationAndOthersKeyValuePairsCaching,
} = require("../../utilities/cache/KeyValuePairsCaching");

exports.createKeyValuePair = async (req, res) => {
  try {
    const { category, value } = req.body;
    if (category == null || value == null) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }
    const pair = await KeyValuePairs.create({
      category,
      value,
    });
    removeCacheDataWhileUpdateAndCreate(["allData"]);
    removeCacheDataWhileUpdateAndCreate([
      "relation",
      "deliverType",
      "groupColor",
      "profileStatusType",
    ]);
    return res.status(201).json({
      success: true,
      pair,
      message: "Key value pair created successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
exports.createCategoryKeyValue = async (req, res) => {
  try {
    const { category, key, value } = req.body;
    if (category == null || value == null || key == null) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }
    const pair = await CategoryKeyValue.create({
      category,
      key,
      value,
    });
    //=============================after adding a new key value pair we need to remove the cache data of the keys==============================
    removeCacheDataWhileUpdateAndCreate([
      "accessTypes",
      "moduleTypes",
      "deliverTypes",
      "moduleAccessTypes",
    ]);
    return res.status(201).json({
      success: true,
      pair,
      message: "Category key value pair created successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCategoryKeyValue = async (req, res) => {
  try {
    //first check if the data is already in the cache
    // let accessTypes = myCache.get("accessTypes");
    // let moduleTypes = myCache.get("moduleTypes");
    // let deliverTypes = myCache.get("deliverTypes");
    // let moduleAccessTypes = myCache.get("moduleAccessTypes");
    //if the data is not stored in the cache then fetch it from the database and store it in the cache
    // if (
    //   accessTypes === undefined ||
    //   moduleTypes === undefined ||
    //   deliverTypes === undefined ||
    //   moduleAccessTypes === undefined
    // ) {
    //   //======================using promise all to fetch all the data at once=====================================
    //   [accessTypes, moduleTypes, deliverTypes, moduleAccessTypes] =
    //     await Promise.all([
    //       CategoryKeyValue.findAll({
    //         where: { category: "collaboration_access_type" },
    //       }),
    //       CategoryKeyValue.findAll({
    //         where: { category: "collaboration_module_type" },
    //       }),
    //       CategoryKeyValue.findAll({ where: { category: "deliver_type" } }),
    //       CategoryKeyValue.findAll({
    //         where: { category: "collaboration_module_access_type" },
    //       }),
    //     ]);
    //   //after 30 days the cache will be cleared automatically and the data will be fetched from the database
    //   myCache.set(
    //     "accessTypes",
    //     accessTypes,
    //     process.env.CLEAR_KEYVALUEPAIRS_CACHE
    //   );
    //   myCache.set(
    //     "moduleTypes",
    //     moduleTypes,
    //     process.env.CLEAR_KEYVALUEPAIRS_CACHE
    //   );
    //   myCache.set(
    //     "deliverTypes",
    //     deliverTypes,
    //     process.env.CLEAR_KEYVALUEPAIRS_CACHE
    //   );
    //   myCache.set(
    //     "moduleAccessTypes",
    //     moduleAccessTypes,
    //     process.env.CLEAR_KEYVALUEPAIRS_CACHE
    //   );
    // }
    const accessTypes = await categoryKeyValuePairsCaching(
      "collaboration_access_type",
      "accessTypes"
    );
    const moduleTypes = await categoryKeyValuePairsCaching(
      "collaboration_module_type",
      "moduleTypes"
    );
    const deliverTypes = await categoryKeyValuePairsCaching(
      "deliver_type",
      "deliverTypes"
    );
    const moduleAccessTypes = await categoryKeyValuePairsCaching(
      "collaboration_module_access_type",
      "moduleAccessTypes"
    );
    const newFeatureFlags = await categoryKeyValuePairsCaching(
      "new_feature_flag",
      "newFeatureFlags"
    );
    return res.status(201).json({
      success: true,
      accessTypes,
      moduleTypes,
      deliverTypes,
      moduleAccessTypes,
      newFeatureFlags,
      message: "Category key values fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCategoryKeyValuePairByCategoryAndKey = async (req, res) => {
  try {
    const category = req.query.category;
    const key = req.query.key;
    var data;
    if (key) {
      data = await CategoryKeyValue.findAll({
        where: { category, key, isDeleted: false },
      });
    } else {
      data = await CategoryKeyValue.findAll({
        where: { category, isDeleted: false },
      });
    }
    if (data) {
      return res.status(200).json({
        success: true,
        data,
        message: "Category key values fetched successfully",
      });
    }
    return res.status(200).json({
      success: true,
      message: "No values available for the category mentioned",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getKeyValuePairs = async (req, res) => {
  try {
    const relations = await getRelationAndOthersKeyValuePairsCaching(
      "relation",
      "relation"
    );
    const deliverTypes = await getRelationAndOthersKeyValuePairsCaching(
      "deliver_type",
      "deliverType"
    );
    const groupColors = await getRelationAndOthersKeyValuePairsCaching(
      "asset_group_color",
      "groupColor"
    );
    const profileStatusTypes = await getRelationAndOthersKeyValuePairsCaching(
      "profile_status_type",
      "profileStatusType"
    );
    const audioWillLimitRestriction = await getRelationAndOthersKeyValuePairsCaching(
      "audio_max_record_duration_limit",
      "audioWillLimitRestriction"
    );
  res.status(200).json({
      success: true,
      relations,
      deliverTypes,
      groupColors,
      profileStatusTypes,
      audioWillLimitRestriction
  });
    // const deliverType = await categoryKeyValuePairsCaching(
    //     "deliver_type",
    //     "deliverType"
    // );
    // const groupColor = await categoryKeyValuePairsCaching(
    //     "asset_group_color",
    //     "groupColor"
    // );
    // const profileStatusType = await categoryKeyValuePairsCaching(

    // const relations = await KeyValuePairs.findAll({
    //   where: { category: "relation", isDeleted: false },
    // });
    // const deliverTypes = await KeyValuePairs.findAll({
    //   where: { category: "deliver_type", isDeleted: false },
    // });
    // const groupColors = await KeyValuePairs.findAll({
    //   where: { category: "asset_group_color", isDeleted: false },
    // });
    // const profileStatusTypes = await KeyValuePairs.findAll({
    //   where: { category: "profile_status_type", isDeleted: false },
    // });
    // res.status(200).json({
    //   success: true,
    //   relations,
    //   deliverTypes,
    //   groupColors,
    //   profileStatusTypes,
    // });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Function to get all the Keyvalue pairs from the system
exports.getAllKP = async (req, res) => {
  try {
    // const allData = await KeyValuePairs.findAll();
    const allData = await getAllKeyValuePairsCaching("allData");
    res.status(200).json({
      success: true,
      allData,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// fetch all category key values
exports.getAllCategoryKeyValues = async (req, res) => {
  try {
    const allCategoryKeyValues = await CategoryKeyValue.findAll({});

    return res.status(200).json({
      success: true,
      data: allCategoryKeyValues
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getSasToken = async (req, res) => {
  try {
    console.warn("This is deprecated. Please use getSasTokenV2 Api")

    const azureSasTokenServiceTypes = await KeyValuePairs.findOne({
      where: { category: "azure_sas_token_services", isDeleted: false },
    });
    const azureSasTokenResourceTypes = await KeyValuePairs.findOne({
      where: { category: "azure_sas_resource_types", isDeleted: false },
    });
    const azureSasTokenPermissionTypes = await KeyValuePairs.findOne({
      where: { category: "azure_sas_permission_types", isDeleted: false },
    });
    const azureSasTokenValidityInMinutes = await KeyValuePairs.findOne({
      where: { category: "azure_sas_validity_in_minutes", isDeleted: false },
    });
    const connectionString = await KeyValuePairs.findOne({
      where: { category: "azure_connection_string", isDeleted: false },
    });
    // Get the storage account name from the connection string
    const storageAccountName = connectionString.value
      .split("AccountName=")[1]
      .split(";")[0];
    const storageAccountKey = connectionString.value
      .split("AccountKey=")[1]
      .split(";")[0];

    // object object containing the storage account name and account key.
    const constants = {
      accountName: storageAccountName,
      accountKey: storageAccountKey,
    };
    // create a shared key credential using the storage account name and account key.
    const sharedKeyCredential = new StorageSharedKeyCredential(
      constants.accountName,
      constants.accountKey
    );
    // official snippet to generate the sas token
    const sasOptions = {
      services: AccountSASServices.parse(
        azureSasTokenServiceTypes.value
      ).toString(), // blobs, tables, queues, files
      resourceTypes: AccountSASResourceTypes.parse(
        azureSasTokenResourceTypes.value
      ).toString(), // service, container, object
      permissions: AccountSASPermissions.parse(
        azureSasTokenPermissionTypes.value
      ), // permissions
      protocol: SASProtocol.Https,
      startsOn: new Date(),
      expiresOn: new Date(
        new Date().valueOf() + azureSasTokenValidityInMinutes.value * 60 * 1000
      ), // 10 minutes
    };

    const sasToken = generateAccountSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    // addind " ? " as this is not given by azure by default
    const sasTokenFinal = sasToken[0] === "?" ? sasToken : `?${sasToken}`;
    const azureSasToken = encryptData(sasTokenFinal);

    res.status(200).json({
      success: true,
      azureSasToken,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*  Diff getSasToken - getSasTokenV2
    This new getSasTokenV2 uses a new encrption menthod to encrypt the sas token which is encryptAESCBCData instead of encryptData
    The main difference of both encrption function is that encryptData used hex encoding using Crypto-JS package and encryptAESCBCData uses base64 encoding using node crypto package*/
exports.getSasTokenV2 = async (req, res) => {
  try {
    const azureSasTokenServiceTypes = await getRelationAndOthersKeyValuePairsCaching(
      "azure_sas_token_services",
      "azureSasTokenServiceTypes"
    );
    const azureSasTokenResourceTypes = await getRelationAndOthersKeyValuePairsCaching(
      "azure_sas_resource_types",
      "azureSasTokenResourceTypes"
    );
    const azureSasTokenPermissionTypes = await getRelationAndOthersKeyValuePairsCaching(
      "azure_sas_permission_types",
      "azureSasTokenPermissionTypes"
    );
    const azureSasTokenValidityInMinutes = await getRelationAndOthersKeyValuePairsCaching(
      "azure_sas_validity_in_minutes",
      "azureSasTokenValidityInMinutes"
    );
    const connectionString = await getRelationAndOthersKeyValuePairsCaching(
      "azure_connection_string",
      "connectionString"
    );

    // Get the storage account name from the connection string
    const storageAccountName = connectionString[0]['dataValues']['value']
      .split("AccountName=")[1]
      .split(";")[0];
    const storageAccountKey = connectionString[0]['dataValues']['value']
      .split("AccountKey=")[1]
      .split(";")[0];

    // object object containing the storage account name and account key.
    const constants = {
      accountName: storageAccountName,
      accountKey: storageAccountKey,
    };
    // create a shared key credential using the storage account name and account key.
    const sharedKeyCredential = new StorageSharedKeyCredential(
      constants.accountName,
      constants.accountKey
    );
    // official snippet to generate the sas token
    const sasOptions = {
      services: AccountSASServices.parse(
        azureSasTokenServiceTypes[0]['dataValues']['value']
      ).toString(), // blobs, tables, queues, files
      resourceTypes: AccountSASResourceTypes.parse(
        azureSasTokenResourceTypes[0]['dataValues']['value']
      ).toString(), // service, container, object
      permissions: AccountSASPermissions.parse(
        azureSasTokenPermissionTypes[0]['dataValues']['value']
      ), // permissions
      protocol: SASProtocol.Https,
      startsOn: new Date(),
      expiresOn: new Date(
        new Date().valueOf() + azureSasTokenValidityInMinutes[0]['dataValues']['value'] * 60 * 1000
      ), 
    };

    const sasToken = generateAccountSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    // addind " ? " as this is not given by azure by default
    const sasTokenFinal = sasToken[0] === "?" ? sasToken : `?${sasToken}`;
    const azureSasToken = encryptAESCBCData(sasTokenFinal);

    res.status(200).json({
      success: true,
      azureSasToken,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getValuesByCategory = async (req, res) => {
  try {
    const category = req.query.category;
    const values = await KeyValuePairs.findAll({
      where: { category, isDeleted: false },
      attributes: ["id", "value"],
    });
    if (values) {
      return res.status(200).json({
        success: true,
        values,
        message: "Values fetched successfully",
      });
    }
    return res.status(200).json({
      success: true,
      message: "No values available for the category mentioned",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCategoryKeyValuePairById = async (req, res) => {
  try {
    const id = req.params.id;
    const { key, value } = req.body;
    const pair = await CategoryKeyValue.update({ key, value }, { where: { id } });
    removeCacheDataWhileUpdateAndCreate([
      "accessTypes",
      "moduleTypes",
      "deliverTypes",
      "moduleAccessTypes",
      "newFeatureFlags",
    ]);
    return res.status(201).json({
      success: true,
      pair,
      message: "Category key value pair updated successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCategoryKeyValuePairById = async (req, res) => {
  try {
    const id = req.params.id;
    const pair = await CategoryKeyValue.update({ isDeleted: true }, { where: { id } });
    removeCacheDataWhileUpdateAndCreate([
      "accessTypes",
      "moduleTypes",
      "deliverTypes",
      "moduleAccessTypes",
    ]);
    return res.status(200).json({
      success: true,
      pair,
      message: "Category key value pair deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateKeyValuePair = async (req, res) => {
  try {
    var values = {};
    var id;
    if (process.env.ENCRYPTION === "true") {
      id = await decryption(req.params.id);
      for (const key in req.body) {
        var temp = await decryption(key);
        var t2 = await decryption(req.body[key]);
        values[temp] = t2;
      }
    } else {
      id = req.params.id;
      values = req.body;
    }

    var { category, value } = values;
    const pair = KeyValuePairs.update(
      {
        category,
        value,
      },
      {
        where: { id },
      }
    );
    removeCacheDataWhileUpdateAndCreate(["allData"]);
    removeCacheDataWhileUpdateAndCreate([
      "relation",
      "deliverType",
      "groupColor",
      "profileStatusType",
    ]);
    values = success(true, "key value pair updated successfully");
    if (process.env.ENCRYPTION === "true") {
      val1 = {};

      for (const key in pair) {
        var temp = encryption(key);
        var t2 = encryption(pair[key]);
        val1[temp] = t2;
      }
      values[encryption("pair")] = val1;
    } else {
      values["pair"] = pair;
    }
    res.status(201).json(values);
  } catch (error) {
    values = success(false, error.message);
    return res.status(400).json(values);
  }
};

exports.deleteKeyValuePair = async (req, res) => {
  try {
    var id;
    if (process.env.ENCRYPTION === "true") {
      id = await decryption(req.params.id);
    } else {
      id = req.params.id;
    }
    const deleted = await KeyValuePairs.update(
      { isDeleted: true },
      { where: { id } },
     
    );
    removeCacheDataWhileUpdateAndCreate(["allData"]);
    removeCacheDataWhileUpdateAndCreate([
      "relation",
      "deliverType",
      "groupColor",
      "profileStatusType",
    ]);
    if (!deleted) {
      value = success(false, "Key value pair not found");
      return res.status(404).json(value);
    }
    value = success(true, "Key value pair deleted successfully");
    return res.status(200).json(value);
  } catch (error) {
    value = success(false, error.message);
    return res.status(400).json(value);
  }
};

exports.hardDeleteKeyValuePair = async (req, res) => {
  try {
    var id;
    if (process.env.ENCRYPTION === "true") {
      id = await decryption(req.params.id);
    } else {
      id = req.params.id;
    }
    const pair = await KeyValuePairs.destroy({
      where: { id },
    });
    removeCacheDataWhileUpdateAndCreate(["allData"]);
    removeCacheDataWhileUpdateAndCreate([
      "relation",
      "deliverType",
      "groupColor",
      "profileStatusType",
    ]);
    if (!pair) {
      value = success(false, "Key value pair not found");
      return res.status(404).json(value);
    }
    value = success(true, "Key value pair deleted successfully");
    return res.status(200).json(value);
  } catch (error) {
    value = success(false, error.message);
    return res.status(400).json(value);
  }
};

// Update deliver typ Real-Time to Real Time

exports.replaceDeilverTypeValuesOfRealTime = async (req, res) => {
  try {
    const id = req.params.id;
    const isUpdated = await KeyValuePairs.update(
      { value: "Real Time" },
      { where: { id } }
    );
    if (isUpdated) {
      res.status(200).json({
        success: true,
        isUpdated,
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.replaceDeliverTypesOfSheredAssets = async (req, res) => {
  try {
    const isUpdated = await ShareAssets.update(
      { deliver_type: "Real Time" },
      { where: { deliver_type: "Real-Time" } }
    );
    if (isUpdated) {
      res.status(200).json({
        success: true,
        isUpdated,
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Function to get minVersion for andoid and iOS from the key value pairs

exports.getMinVersion = async (req, res) => {
  try {
    const androidMinVersion = await KeyValuePairs.findOne({
      where: { category: "minAppVersion", isDeleted: false },attributes:["id","value"],
    });
    const iosMinVersion = await KeyValuePairs.findOne({
      where: { category: "appleMinVersion", isDeleted: false },attributes:["id","value"],
    });
    minVersion=[{"android":androidMinVersion},{"ios":iosMinVersion}];
    return res.status(200).json({
      success: true,
      minVersion : minVersion,
      message: "Min version fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};