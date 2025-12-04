import { DataTypes, Model, Sequelize } from "sequelize";
import { NewsArticleAttributes } from "../../../interfaces/toolInterfaces/interfaces/uamInterface";

export class NewsArticle
  extends Model<NewsArticleAttributes, Partial<NewsArticleAttributes>>
  implements NewsArticleAttributes {
  declare id?: number;
  declare title: string;
  declare newsPaperName: string;
  declare newsLink: string;
  declare releaseDate: Date;
  declare excerpts: string;
  declare beginDate: Date;
  declare endDate: Date;
  declare image?: string | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  NewsArticle.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      title: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      newsPaperName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      newsLink: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      releaseDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      excerpts: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      beginDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      image: {
        type: dataTypes.TEXT("long"),
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "newsArticle",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      freezeTableName: true,
    }
  );

  return NewsArticle;
};
