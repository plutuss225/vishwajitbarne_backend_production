const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
} = require("../controllers/eventController");
const authMiddleware = require("../middleware/authMiddleware");

// GET ALL EVENTS
router.get("/", getAllEvents);

// GET EVENT BY ID
router.get("/:id", getEventById);

// CREATE EVENT
router.post("/", authMiddleware, createEvent);

// UPDATE EVENT
router.put("/:id", authMiddleware, updateEvent);

// DELETE EVENT
router.delete("/:id", authMiddleware, deleteEvent);

module.exports = router;
