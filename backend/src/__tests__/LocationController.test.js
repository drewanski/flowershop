const LocationController = require('../controllers/LocationController');

describe('delivery address geocoding', () => {
  const originalToken = process.env.MAPBOX_ACCESS_TOKEN;
  const originalFetch = global.fetch;
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
    else process.env.MAPBOX_ACCESS_TOKEN = originalToken;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('rejects invalid queries and reports fallback provider failures clearly', async () => {
    const invalid = response();
    await LocationController.geocode({ body: { query: 'x' } }, invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);

    delete process.env.MAPBOX_ACCESS_TOKEN;
    global.fetch = jest.fn().mockRejectedValue(new Error('Offline'));
    const unavailable = response();
    await LocationController.geocode({ body: { query: '123 Main Street, Manila' } }, unavailable);
    expect(unavailable.status).toHaveBeenCalledWith(502);
    expect(unavailable.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Drop a pin') }));
  });

  test('returns geocoded Philippines locations without exposing the provider token', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'server-only-test-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: { full_address: '123 Main Street, Manila, Philippines' }, geometry: { coordinates: [120.99, 14.6] } }] }),
    });
    const res = response();
    await LocationController.geocode({ body: { query: '123 Main Street, Manila' } }, res);
    const url = new URL(global.fetch.mock.calls[0][0]);
    expect(url.searchParams.get('country')).toBe('PH');
    expect(url.searchParams.get('permanent')).toBe('true');
    expect(url.searchParams.get('access_token')).toBe('server-only-test-token');
    expect(res.json).toHaveBeenCalledWith({
      payload: [{ label: '123 Main Street, Manila, Philippines', longitude: 120.99, latitude: 14.6 }],
      message: 'Matching locations.',
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('server-only-test-token');
  });

  test('reverse geocodes a map point into editable delivery address details', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'server-only-test-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: { feature_type: 'address', full_address: '123 Sampaguita Street, Quezon City', context: {
        street: { name: 'Sampaguita Street' }, neighborhood: { name: 'Barangay Central' }, place: { name: 'Quezon City' }, region: { name: 'Metro Manila' }, postcode: { name: '1100' },
      } } }] }),
    });
    const res = response();
    await LocationController.reverseGeocode({ body: { latitude: 14.65, longitude: 121.03 } }, res);
    const url = new URL(global.fetch.mock.calls[0][0]);
    expect(url.pathname).toContain('/search/geocode/v6/reverse');
    expect(url.searchParams.get('latitude')).toBe('14.65');
    expect(url.searchParams.get('longitude')).toBe('121.03');
    expect(url.searchParams.get('country')).toBe('PH');
    expect(url.searchParams.get('permanent')).toBe('true');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ payload: {
      street: 'Sampaguita Street', barangay: 'Barangay Central', city: 'Quezon City', province: 'Metro Manila', zipCode: '1100', formattedAddress: '123 Sampaguita Street, Quezon City',
    } }));
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('server-only-test-token');
  });

  test('validates reverse coordinates and uses the OSM fallback when Mapbox is not configured', async () => {
    const invalid = response();
    await LocationController.reverseGeocode({ body: { latitude: 190, longitude: 121 } }, invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
    delete process.env.MAPBOX_ACCESS_TOKEN;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ display_name: 'Sampaguita Street, Quezon City', address: {
      house_number: '12', road: 'Sampaguita Street', suburb: 'Barangay Central', city: 'Quezon City', state: 'Metro Manila', postcode: '1100',
    } }) });
    const res = response();
    await LocationController.reverseGeocode({ body: { latitude: 14.65, longitude: 121.03 } }, res);
    expect(global.fetch.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
    expect(global.fetch.mock.calls[0][1].headers['User-Agent']).toContain('KapeAndCo');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ payload: {
      street: '12 Sampaguita Street', barangay: 'Barangay Central', city: 'Quezon City', province: 'Metro Manila', zipCode: '1100', formattedAddress: 'Sampaguita Street, Quezon City',
    } }));
  });
});

test('Photon fallback filters other countries and caches matching addresses',async()=>{
  const previous=global.fetch;const token=process.env.MAPBOX_ACCESS_TOKEN;delete process.env.MAPBOX_ACCESS_TOKEN;
  try {
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({features:[{properties:{countrycode:'PH',name:'Test Landmark',city:'Manila',state:'Metro Manila'},geometry:{coordinates:[121,14]}},{properties:{countrycode:'US',name:'Wrong Country'},geometry:{coordinates:[-70,40]}}]})});
    const res={json:jest.fn(),status:jest.fn().mockReturnThis()};
    await LocationController.geocode({body:{query:'Test Landmark Manila'}},res);
    expect(res.json.mock.calls[0][0].payload).toEqual([{label:'Test Landmark, Manila, Metro Manila',longitude:121,latitude:14}]);
    await LocationController.geocode({body:{query:'Test Landmark Manila'}},res);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {global.fetch=previous;if(token===undefined)delete process.env.MAPBOX_ACCESS_TOKEN;else process.env.MAPBOX_ACCESS_TOKEN=token;}
});
