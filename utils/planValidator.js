const User = require("../models/User");

const checkPlanLimit = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { allowed: false, message: "រកមិនឃើញគណនី!" };

  // បើ Pro ឬ Elite គឺឱ្យប្រើសេរីហ្មង (Unlimited)
  if (user.plan === "pro" || user.plan === "elite") return { allowed: true };

  // សម្រាប់ Standard (Free) កំណត់ត្រឹម ៥ ដងក្នុងមួយថ្ងៃ
  const today = new Date().setHours(0, 0, 0, 0);
  const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

  if (today > lastReqDate) {
    // ចូលដល់ថ្ងៃថ្មី យើង Reset ចំនួនសំណួរឡើងវិញ
    user.requestCount = 1;
    user.lastRequestDate = Date.now();
    await user.save();
    return { allowed: true };
  }

  if (user.requestCount >= 5) {
    return {
      allowed: false,
      message:
        "អូយបង! គម្រោង Standard អស់ដែនកំណត់សម្រាប់សំណួរហើយបង! Upgrade ទៅ Pro ដើម្បីសួរមិនកំណត់! 🚀",
    };
  }

  // បើនៅសល់សំណួរ យើងបូកបញ្ចូល ១ ទៀត
  user.requestCount += 1;
  await user.save();
  return { allowed: true };
};

module.exports = checkPlanLimit;
