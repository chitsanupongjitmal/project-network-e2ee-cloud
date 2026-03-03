
const db = require('../config/db');


const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {

        const userRole = req.user.role; 

        if (!userRole) {
            return res.status(403).json({ message: "Forbidden: No role assigned." });
        }

        try {

            const [permissions] = await db.query(
                `SELECT p.name FROM permissions p
                 JOIN role_permissions rp ON p.id = rp.permission_id
                 JOIN roles r ON rp.role_id = r.id
                 WHERE r.name = ?`,
                [userRole]
            );

            const userPermissions = permissions.map(p => p.name);

            if (userPermissions.includes(requiredPermission)) {
                next();
            } else {
                return res.status(403).json({ message: "Forbidden: You do not have the required permission." });
            }
        } catch (error) {
            console.error("Permission check error:", error);
            return res.status(500).json({ message: "Server error during permission check." });
        }
    };
};

module.exports = checkPermission;