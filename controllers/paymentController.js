const User = require("../models/User");

exports.processUpgrade = async (req, res) => {
  try {
    const { planType, firebaseUid } = req.body;
    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីបងទេ!" });
    }

    // ធ្វើបច្ចុប្បន្នភាព Plan និង Reset កុងទ័រ
    user.plan = planType;
    user.requestCount = 0;
    user.lastRequestDate = Date.now();
    await user.save();

    res.json({
      success: true,
      message: `អបអរសាទរមេ! ឥឡូវបងគឺជាម្ចាស់គម្រោង ${planType.toUpperCase()} ហើយ! 🚀`,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error: " + error.message,
      });
  }
};
exports.cancelSubscription = async (req, res) => {
    try {
        const { firebaseUid } = req.body;
        const user = await User.findOne({ firebaseUid });

        if (!user) {
            return res.status(404).json({ success: false, message: "រកមិនឃើញគណនីបងទេ!" });
        }

        // ១. ប្តូរ Plan មក Standard វិញភ្លាមៗ
        user.plan = 'standard'; 
        // ២. កំណត់ Quota ឱ្យនៅត្រឹម ៥ វិញ (Optional)
        user.requestCount = 5; 
        await user.save();

        res.json({ 
            success: true, 
            message: "បងបានបោះបង់គម្រោងជោគជ័យហើយ! ឥឡូវបងត្រឡប់មកជា Standard Member វិញហើយ។ 😢" 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};