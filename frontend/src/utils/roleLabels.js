
const ROLE_META_MAP = {
    'user': { label: 'User', classes: 'text-gray-700 bg-gray-100' },
    'member': { label: 'Member', classes: 'text-gray-700 bg-gray-100' },
    'super-admin': { label: 'Super Admin', classes: 'text-red-700 bg-red-100' },
    'superadmin': { label: 'Super Admin', classes: 'text-red-700 bg-red-100' },
    'admin': { label: 'Admin', classes: 'text-orange-700 bg-orange-100' },
    'group-admin': { label: 'Group Admin', classes: 'text-blue-700 bg-blue-100' },
    'groupadmin': { label: 'Group Admin', classes: 'text-blue-700 bg-blue-100' },
    'moderator': { label: 'Moderator', classes: 'text-purple-700 bg-purple-100' },
    'owner': { label: 'Owner', classes: 'text-amber-700 bg-amber-100' },
};

export const getRoleMeta = (roleName) => {
    if (!roleName) return null;

    const normalized = roleName.toString().trim().toLowerCase();
    const normalizedKey = normalized.replace(/[\s_]+/g, '-');
    const meta =
        ROLE_META_MAP[normalizedKey]
        || ROLE_META_MAP[normalized]
        || ROLE_META_MAP[normalized.replace(/-/g, '')];

    if (meta) return meta;

    const label = normalizedKey.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    return { label, classes: 'text-purple-700 bg-purple-100' };
};
