const express = require("express");
const router = express.Router();
const {
  getAllDevelopmentWork,
  getDevelopmentWorkById,
  createDevelopmentWork,
  updateDevelopmentWork,
  deleteDevelopmentWork,
  getCategories,
  getDevelopmentWorkByCategory,
  getTopDevelopmentWorkByCategory,
  streamDevelopmentWorkVideo,
  getLatestDevelopmentWorkByYear
} = require("../controllers/developmentWorkController");
const authMiddleware = require("../middleware/authMiddleware");

// GET ALL NEWS
router.get("/", getAllDevelopmentWork);

// GET DISTINCT CATEGORIES (max 4)
router.get("/categories", getCategories);

// GET ALL NEWS BY CATEGORY (latest first, optional ?category=Sports)
router.get("/by-category", getDevelopmentWorkByCategory);

// GET TOP 3 NEWS BY CATEGORY (max 3, optional ?category=Sports)
router.get("/by-category/top", getTopDevelopmentWorkByCategory);

// STREAM VIDEO ENDPOINT
router.get("/media/:id", streamDevelopmentWorkVideo);

// GET LATEST BY PLACES
router.get("/latest-by-places", require("../controllers/developmentWorkController").getLatestDevelopmentWorkByPlaces);

// GET LATEST 1 PER YEAR (4 most recent years)
router.get("/latest-by-year", getLatestDevelopmentWorkByYear);

// GET BY ID
router.get("/:id", getDevelopmentWorkById);

// INSERT NEWS
router.post("/", authMiddleware, createDevelopmentWork);

// UPDATE NEWS
router.put("/:id", authMiddleware, updateDevelopmentWork);

// DELETE NEWS
router.delete("/:id", authMiddleware, deleteDevelopmentWork);



module.exports = router;