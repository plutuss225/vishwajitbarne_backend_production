const express = require("express");
const { 
  getAllElections, 
  getElectionById, 
  createElection, 
  updateElection, 
  deleteElection, 
  getCategories,
  getCategoriesByYear
} = require("../controllers/electionsController");

const router = express.Router();

router.get("/", getAllElections);
router.get("/categories", getCategories);
router.get("/years/:year/categories", getCategoriesByYear);
router.get("/:id", getElectionById);
router.post("/", createElection);
router.put("/:id", updateElection);
router.delete("/:id", deleteElection);

module.exports = router;
