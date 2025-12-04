const { db } = require("../../models/index");
const NodeCache = require("node-cache");
const myCache = new NodeCache();
const CategoryKeyValue = db.categoryKeyValue;
const KeyValuePairs = db.keyValuePairs;

exports.categoryKeyValuePairsCaching = async (category, cacheKey) => {
  // =================================Check if the data is already cached==========================================
  let cachedData = myCache.get(cacheKey);
  // =================================if the data is not stored than fetch it from the database=========================
  if (cachedData === undefined) {
    cachedData = await CategoryKeyValue.findAll({
      where: { category: category }, order: [['id', 'ASC']], 
    });
    //=====================================setting the data into the cache memory===========================================
    myCache.set(cacheKey, cachedData, process.env.CLEAR_KEYVALUEPAIRS_CACHE);
  }
  return cachedData;
};

//===============this function will delete all the cache data of the given keys while updating and creating new keyValuePairs data=====================

//if we do not remove the old data while creating or updating, then the old data will be shown in the response
exports.removeCacheDataWhileUpdateAndCreate = (cacheKey) => {
  cacheKey.forEach((key) => {
    myCache.del(key);
  });
};


exports.getAllKeyValuePairsCaching = async (cacheKey) => {
    // =================================Check if the data is already cached==========================================
    let cachedData = myCache.get(cacheKey);
    // =================================if the data is not stored than fetch it from the database=========================
    if (cachedData === undefined) {
        cachedData = await KeyValuePairs.findAll();
        //=====================================setting the data into the cache memory===========================================
        myCache.set(cacheKey, cachedData, process.env.CLEAR_KEYVALUEPAIRS_CACHE);
    }
    return cachedData;
}


//this function will fetch relation, deliverType, and other keyValuePairs data from the database and store it in the cache memory
exports.getRelationAndOthersKeyValuePairsCaching = async (category,cacheKey) => {
    // =================================Check if the data is already cached==========================================
    let cachedData = myCache.get(cacheKey);
    // =================================if the data is not stored than fetch it from the database=========================
    if (cachedData === undefined) {
        cachedData = await KeyValuePairs.findAll({
            where: {
                category: category,
            },
        });
        //=====================================setting the data into the cache memory===========================================
        myCache.set(cacheKey, cachedData, process.env.CLEAR_KEYVALUEPAIRS_CACHE);
    }
    return cachedData;
}
