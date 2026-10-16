// Small-volume fallback for local storefronts without a Mapbox key.
// Use a configured/self-hosted Photon service or Mapbox for production traffic.
const addressSearchCache = new Map();
const photonSearch = async (query) => {
  const key = query.toLowerCase();
  const cached = addressSearchCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.payload;
  const base = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';
  const params = new URLSearchParams({ q: query, limit: '5', lang: 'en', bbox: '116,4,127,22' });
  const response = await fetch(`${base.replace(/\/$/, '')}/api/?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Address provider unavailable');
  const data = await response.json();
  const payload = (data.features || []).filter(feature => (feature.properties?.countrycode || '').toUpperCase() === 'PH').map(feature => {
    const p = feature.properties || {};
    const parts = [p.housenumber, p.street, p.name, p.district, p.city, p.state, p.postcode].filter(Boolean);
    return { label: [...new Set(parts)].join(', '), longitude: feature.geometry?.coordinates?.[0], latitude: feature.geometry?.coordinates?.[1] };
  }).filter(place => place.label && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  if (addressSearchCache.size >= 100) addressSearchCache.delete(addressSearchCache.keys().next().value);
  addressSearchCache.set(key, { payload, expires: Date.now() + 300000 });
  return payload;
};

const geocode = async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (query.length < 4 || query.length > 256 || query.includes(';')) {
    return res.status(400).json({ message: 'Enter an address between 4 and 256 characters.' });
  }
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    try { const payload = await photonSearch(query); return res.json({ payload, message: payload.length ? 'Matching locations.' : 'No matching address found.' }); }
    catch { return res.status(502).json({ message: 'Address search is temporarily unavailable. Drop a pin on the map and check the address details.' }); }
  }
  try {
    const params = new URLSearchParams({ q: query, access_token: token, country: 'PH', limit: '5', autocomplete: 'false', permanent: 'true' });
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ message: 'Address search is temporarily unavailable.' });
    const payload = (result.features || []).map((feature) => ({
      label: feature.properties?.full_address || feature.properties?.place_formatted || feature.properties?.name || 'Matching location',
      longitude: feature.geometry?.coordinates?.[0],
      latitude: feature.geometry?.coordinates?.[1],
    })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
    return res.json({ payload, message: payload.length ? 'Matching locations.' : 'No matching address found.' });
  } catch (error) {
    return res.status(502).json({ message: 'Address search is temporarily unavailable.' });
  }
};

let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

const reverseGeocode = async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Choose a valid point on the map.' });
  }
  try {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    let payload;
    if (token) {
      const params = new URLSearchParams({ longitude: String(longitude), latitude: String(latitude), access_token: token, country: 'PH', permanent: 'true', types: 'address,street,neighborhood,locality,place,postcode,district,region' });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
      const result = await response.json();
      if (!response.ok) return res.status(502).json({ message: 'Automatic address lookup is temporarily unavailable.' });
      const features = result.features || [];
      const props = (type) => features.find((feature) => feature.properties?.feature_type === type)?.properties;
      const address = props('address');
      const streetFeature = props('street');
      const context = address?.context || streetFeature?.context || features[0]?.properties?.context || {};
      const name = (value) => typeof value?.name === 'string' ? value.name : '';
      payload = {
        street: [address?.address, name(context.street) || (streetFeature ? streetFeature.name || '' : '')].filter(Boolean).join(' '),
        barangay: name(context.neighborhood) || name(context.district) || name(context.locality),
        city: name(context.place) || name(context.locality) || name(context.district),
        province: name(context.region), zipCode: name(context.postcode),
        formattedAddress: address?.full_address || streetFeature?.full_address || features[0]?.properties?.full_address || '',
      };
    } else {
      // Nominatim's public endpoint is a small-volume fallback for a user-placed pin.
      // Serialize calls globally and leave at least one second between requests.
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1', zoom: '18', 'accept-language': 'en' });
      const request = nominatimQueue.then(async () => {
        const wait = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        lastNominatimRequestAt = Date.now();
        return fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { 'User-Agent': 'KapeAndCo/1.0 (customer delivery address lookup)' } });
      });
      nominatimQueue = request.then(() => undefined, () => undefined);
      const response = await request;
      const result = await response.json();
      if (!response.ok || result.error) return res.status(502).json({ message: 'Automatic address lookup is temporarily unavailable.' });
      const address = result.address || {};
      const street = address.road || address.pedestrian || address.residential || address.footway || '';
      const houseNumber = address.house_number || '';
      payload = {
        street: [houseNumber, street].filter(Boolean).join(' '),
        barangay: address.suburb || address.neighbourhood || address.quarter || address.city_district || address.village || '',
        city: address.city || address.town || address.municipality || address.city_district || address.county || '',
        province: address.state || address.province || address.region || '', zipCode: address.postcode || '', formattedAddress: result.display_name || '',
      };
    }
    return res.json({ payload, message: 'Address details found.' });
  } catch (error) {
    return res.status(502).json({ message: 'Automatic address lookup is temporarily unavailable.' });
  }
};

module.exports = { geocode, reverseGeocode };
