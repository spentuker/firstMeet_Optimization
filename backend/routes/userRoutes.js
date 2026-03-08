const express = require("express");
const router = express.Router();
const { signUp, getUserByUsername, updateUser, getAllUsers } = require("../controllers/signUpController");

router.post("/signUp", signUp);
router.get("/", getAllUsers);
router.get("/:userName", getUserByUsername);
router.put("/:id", updateUser);

module.exports = router;
