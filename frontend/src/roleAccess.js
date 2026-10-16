const homes = { customer: '/userinfo', crew: '/adminpanel', manager: '/adminpanel', admin: '/adminpanel', delivery: '/delivery' };
export const roleHome = role => homes[role] || '/login';
export const loginDestination = (role, returnTo) => {
  if (role === 'customer' && typeof returnTo === 'string' && /^\/(?:checkout|cart|userinfo|loguser|wishlist|shop|products(?:\/[^?#]*)?|payment\/result)(?:[?#].*)?$/.test(returnTo)) return returnTo;
  return roleHome(role);
};
