/**
 * Auth Middleware: ឆ្មាំទ្វារឆែកមើលសំបុត្រចូល (Session)
 */
module.exports = (req, res, next) => {
    // ឆែកមើលថា តើមាន userId ក្នុង Session ឬអត់
    if (req.session && req.session.userId) {
        return next(); // បើមាន ឱ្យចូលទៅមុខទៀតបាន
    }
    
    // បើគ្មានទេ បណ្តេញទៅទំព័រ Login វិញភ្លាម!
    console.log("⚠️ ចូលលួចមើលមែនទេ? ទៅ Login សិនបងប្រូ!");
    res.redirect("/login"); 
};