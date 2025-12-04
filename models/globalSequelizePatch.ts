import {
  Model,
  Utils,
  ModelAttributes,
  InitOptions,
  ModelStatic,
} from "sequelize";

// Keep original
const originalInit = Model.init;

(Model as any).init = function <
  M extends Model = Model
>(
  this: ModelStatic<M>,
  attributes: ModelAttributes<M, unknown>,
  options: InitOptions<M>
): ModelStatic<M> {
  if (!options || !options.sequelize) {
    throw new Error(
      "Missing required 'sequelize' property in options for Model.init."
    );
  }

  const originalTableName = options.tableName ?? options.modelName;

  const pluralizeFn = (Utils as any).pluralize;
  const pluralized = options.tableName ? options.tableName.toLowerCase() : pluralizeFn(options.modelName).toLowerCase();
  options.tableName = pluralized;

  console.log(
    `[GLOBAL INIT OVERRIDE] Model: ${originalTableName} → Table: ${options.tableName}`
  );

  return (originalInit as any).call(this, attributes, options);
};

console.log("Global Sequelize.init patch applied.");
