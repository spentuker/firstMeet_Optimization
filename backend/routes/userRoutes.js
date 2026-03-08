const express = require("express");
const router = express.Router();
const { signUp, signIn, getUserByUsername, updateUser, getAllUsers } = require("../controllers/userController");

router.post("/signUp", signUp);
router.post("/signIn", signIn);
router.get("/", getAllUsers);
router.get("/:userName", getUserByUsername);
router.put("/:id", updateUser);

module.exports = router;
