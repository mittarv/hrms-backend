// controllers/tools/keyValuePair/keyValuePairApprovalController.js
const { db } = require("../../../models/index");
const KeyValuePairApproval = db.keyValuePairApproval;
const CategoryKeyValue = db.categoryKeyValue;
const KeyValuePairs = db.keyValuePairs;
const { removeCacheDataWhileUpdateAndCreate, getAllKeyValuePairsCaching, } = require("../../../utilities/cache/KeyValuePairsCaching");
const success = require("../../../security/message");

const { clearCacheOnApiCall } = require("../../../utilities/helperFunctions");

exports.createKeyValuePairApproval = async (req, res) => {

  const keyValuePairs = req.body;

  if (!keyValuePairs || keyValuePairs.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required Key Value Pairs" 
    });
  }
  
  keyValuePairs?.forEach(kvp => {
    if (!kvp.category || !kvp.value || !kvp.description) {
      return res.status(400).json({ 
          success: false, 
          message: "Category, value, and description fields are required" 
      });
    }
  });

  try {

    const KVPApprovalPromises = keyValuePairs?.map(async (kvp) => {      
      const KVPApprovalRecordAdded = await KeyValuePairApproval.create({
        category: kvp?.category,
        value: kvp?.value,
        key: kvp?.key,
        description: kvp?.description,
        requestedBy: kvp?.requestedBy,
        actionStatus: false, 
        requestedAt: new Date(Date.now() + 19800000),
        requestedId: kvp?.requestedId || null,   
        actionToPerform: kvp?.actionToPerform,
      });
      return KVPApprovalRecordAdded;
    });

    const updatedData = await Promise.all(KVPApprovalPromises);

    return res.status(201).json({ success: true, data: updatedData });
  } catch (error) {
      console.error('Error creating entry:', error);
      return res.status(500).json({ 
          success: false, 
          message: "Error creating entry", 
          error: error.message 
      });
  }
};

exports.getKeyValuePairApprovals = async (req, res) => {
    try {
        const approvals = await KeyValuePairApproval.findAll(); // Fetch all entries
        return res.status(200).json({ success: true, data: approvals });
    } catch (error) {
        console.error('Error fetching entries:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Error fetching entries", 
            error: error.message 
        });
    }
};

exports.updateKeyValuePairApprovalStatus = async (req, res) => {
  const { id } = req.params;
  const { approvedBy } = req.body;
  
  try {
    const updatedPair = await KeyValuePairApproval.update(
      { actionStatus: true, approvedBy, approvedAt: new Date(Date.now() + 19800000) },
      { where: { id } }
    );



    if (updatedPair[0] === 0) {
      return res.status(404).json({ success: false, message: "Key value pair not found" });
    }
  
    return res.status(200).json({
      success: true,
      message: "Key value pair approval status updated successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteKeyValuePairApproval = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedPair = await KeyValuePairApproval.destroy({
      where: { id }
    });

    if (deletedPair === 0) {
      return res.status(404).json({ success: false, message: "Key value pair not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Key value pair deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateKeyValuePairOnApproval = async (req, res) => {
    const { id } = req.params;
    const { category, value } = req.body; // Expecting category and value in the request body

    try {
        // Clearing the cache memory to store updated data
        removeCacheDataWhileUpdateAndCreate(["allData"]);
        // Update the KeyValuePairs table
        const updatedPair = await KeyValuePairs.update(
            { category, value },
            { where: { id } } // Assuming id corresponds to the KeyValuePairs id
        );

        if (updatedPair[0] === 0) {
            return res.status(404).json({ success: false, message: "Key value pair not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Key value pair updated successfully",
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
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



exports.ClearKeyValueCache = async (req, res) => {
  const KpTargetValue ="/api/tools/keyValuePair/getAllKP";
  const CategoryKpTargetValue ="/api/tools/keyValuePair/getAllCategoryKP";
  try {
    clearCacheOnApiCall(KpTargetValue);
    clearCacheOnApiCall(CategoryKpTargetValue);
    // Clear the cache memory to store updated data
    removeCacheDataWhileUpdateAndCreate(["allData"]);
    return res.status(200).json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }


}

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