const { db } = require("../../../models/index");
const NewsArticle = db.newsArticle;
const { Op } = require("sequelize");

//=========================================create new article api==============================================
exports.createNewsArticle = async (req, res) => {
  try {
    const { articleArr } = req.body;
    for (var i = 0; i < articleArr.length; i++) {
      var article = articleArr[i];
      if (
        article.title === "" ||
        article.newsPaperName === "" ||
        article.newsLink === "" ||
        article.releaseDate === "" ||
        article.beginDate === "" ||
        article.endDate === "" ||
        article.image === "" ||
        article.excerpts === ""
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill all the details" });
      }

      await NewsArticle.create({
        title: article.title,
        newsPaperName: article.newsPaperName,
        newsLink: article.newsLink,
        releaseDate: article.releaseDate,
        beginDate: article.beginDate,
        endDate: article.endDate,
        image: article.image,
        excerpts: article.excerpts,
      });
    }
    return res
      .status(201)
      .json({ success: true, message: "News Article created successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

//================================delete multiple news article==============================================
exports.deleteNewsArticle = async (req, res) => {
  try {
    //========================passing multiple ids from the frontend==========================================
    const ids = req.body;
    const newsArticle = await NewsArticle.findOne({ where: { id: ids } });
    if (!newsArticle) {
      return res
        .status(404)
        .json({ success: false, message: "There is no such news article" });
    }
    await NewsArticle.update({ isDeleted: true }, { where: { id: ids } });

    return res
      .status(200)
      .json({ success: true, message: "News Article deleted successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

//===================================update multiple article =============================================
exports.updateNewsArticle = async (req, res) => {
  try {
    const { arrticleArr } = req.body;
    if (!arrticleArr || arrticleArr === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }
    for (var i = 0; i < arrticleArr.length; i++) {
      const article = arrticleArr[i];
      if (
        article.title === "" ||
        article.newsPaperName === "" ||
        article.newsLink === "" ||
        article.releaseDate === "" ||
        article.beginDate === "" ||
        article.endDate === "" ||
        article.image === "" ||
        article.excerpts === ""
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill all the details" });
      }
      await NewsArticle.update(
        {
          title: article.title,
          newsPaperName: article.newsPaperName,
          newsLink: article.newsLink,
          releaseDate: article.releaseDate,
          beginDate: article.beginDate,
          endDate: article.endDate,
          image: article.image,
          excerpts: article.excerpts,
        },
        { where: { id: article.id } }
      );
    }
    return res.status(200).json({
      success: true,
      message: "Article updated successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

//==========================================get all news article api========================================
exports.getAllNewsArticles = async (req, res) => {
  try {
    const currentDate = new Date();
    const newsArticle = await NewsArticle.findAll({
      where: {
        beginDate: {
          [Op.lte]: currentDate, // Less than or equal to the current date
        },
        endDate: {
          [Op.gte]: currentDate, // Greater than or equal to the current date
        },
        isDeleted: false,
      },
      order: [["createdAt"]],
    });
    if (!newsArticle) {
      return res.status(404).json({
        success: false,
        message: "There are no news articles currently",
      });
    }
    return res.status(201).json({
      success: true,
      newsArticle,
      message: "News Articles fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
