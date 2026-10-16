import { loginDestination } from './roleAccess';
test.each(['//evil.example','https://evil.example','/login','/employee-login','/adminpanel','/delivery','/checkout/../../adminpanel'])('rejects inappropriate customer return path %s',path=>{
  expect(loginDestination('customer',path)).toBe('/userinfo');
});
