const express = require('express');
const { deleteNewsArticle, updateNewsArticle, getAllNewsArticles, createNewsArticle } = require('../../../controllers/tools/uam/newsArticleController');
const { isTmsUserAuthenticated } = require('../../../middlewares/isAuthenticated');
const router = express.Router();

router.route("/news-article/add").post(isTmsUserAuthenticated, createNewsArticle)
router.route("/news-article/delete").patch(isTmsUserAuthenticated,deleteNewsArticle)
router.route("/news-article/update").patch(isTmsUserAuthenticated,updateNewsArticle)
router.route("/news-article/getall").get(isTmsUserAuthenticated,getAllNewsArticles)


module.exports = router;