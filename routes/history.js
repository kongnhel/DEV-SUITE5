// ក្នុង routes/history.js
const express = require("express");
const router = express.Router();
// ១. កែឈ្មោះកន្លែង Import ឱ្យត្រូវនឹង Model ប្អូន
const ChatHistory = require("../models/ChatHistory");

// routes/history.js
router.get("/history/:id", async (req, res) => {
  try {
    const record = await ChatHistory.findById(req.params.id);
    if (!record) return res.status(404).send("Memory not found!");

    res.render("history-detail", {
      title: "Memory Decryption",
      record: record,
      user: req.session.user,
      // ១. បន្ថែម theme ទៅទីនេះ ដើម្បីបំបាត់ Error
      theme: "#ff4d00",
    });
  } catch (err) {
    res.status(500).send("Neural Link Interrupted: " + err.message);
  }
});
// ផ្លូវសម្រាប់លុប (DELETE /history/:id)
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deletedRecord = await ChatHistory.findByIdAndDelete(id);

    if (!deletedRecord) {
      return res.status(404).send({ error: "រកមិនឃើញទិន្នន័យដើម្បីលុបទេ!" });
    }

    res.status(200).send({ message: "លុបដានជើងបានសម្រេច!" });
  } catch (e) {
    res.status(500).send({ error: "លុបអត់ចេញទេបង៖ " + e.message });
  }
});
module.exports = router;
