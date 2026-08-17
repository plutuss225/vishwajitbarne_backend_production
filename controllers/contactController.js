const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

async function translateContactItem(item, targetLang) {
  if (!targetLang) return item;
  try {
    const [translatedSubj, translatedMsg] = await Promise.all([
      translateText(item.subject, targetLang),
      translateText(item.message, targetLang),
    ]);
    return {
      ...item,
      subject: translatedSubj || item.subject,
      message: translatedMsg || item.message,
    };
  } catch (err) {
    console.error("Error translating contact item:", err.message);
    return item;
  }
}

// CREATE contact message (Public)
exports.createContact = async (req, res) => {
  const { name, phone_number, email, subject, message } = req.body;

  if (!name || !phone_number || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields (name, phone_number, email, subject, message) are required" });
  }

  try {
    const result = await prisma.contact_messages.create({
      data: {
        name,
        phone_number,
        email,
        subject,
        message,
      },
    });

    res.status(201).json({
      message: "Contact message sent successfully",
      id: result.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET all contact messages (Admin only)
exports.getAllContacts = async (req, res) => {
  const { is_read } = req.query;
  const where = {};

  if (is_read !== undefined) {
    where.is_read = (is_read === "true" || is_read === "1");
  }

  try {
    let result = await prisma.contact_messages.findMany({
      where,
      orderBy: { id: 'desc' },
    });
    
    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      result = await Promise.all(
        result.map(item => translateContactItem(item, targetLang))
      );
    }
    res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// MARK contact message as read (Admin only)
exports.markAsRead = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const result = await prisma.contact_messages.update({
      where: { id },
      data: { is_read: true },
    });
    res.json({ message: "Contact message marked as read" });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Contact message not found" });
    }
    return res.status(500).json({ error: err.message });
  }
};

// DELETE contact message (Admin only)
exports.deleteContact = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.contact_messages.delete({
      where: { id },
    });
    res.json({ message: "Contact message deleted successfully" });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Contact message not found" });
    }
    return res.status(500).json({ error: err.message });
  }
};
