import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import StoreHeader from '../components/StoreHeader';
import CoffeeProductCard from '../components/CoffeeProductCard';
import { apiRequest } from '../api';
import './CoffeeShop.css';
export default function CoffeeShopPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(params.get('category') || 'All');
  const [price, setPrice] = useState('All'); const [style, setStyle] = useState('All');
  const [sort, setSort] = useState('default'); const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { setCategory(params.get('category') || 'All'); }, [params]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    apiRequest('/products?status=available&isAddon=false').then(({ok,data})=>{
      if(!ok) throw new Error(data?.message || 'Unable to load the coffee menu.');
      if(active) setProducts(Array.isArray(data?.payload) ? data.payload : []);
    }).catch(failure=>{if(active) setError(failure.message);}).finally(()=>{if(active) setLoading(false);});
    return ()=>{active=false;};
  }, [retry]);
  const categories=[...new Set(products.map(product=>product.category).filter(Boolean))];
  const styles=[...new Set(products.map(product=>product.type).filter(Boolean))];
  const results=products.filter(product=>{
    const matchesSearch=[product.name,product.description,product.category,product.type].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (category==='All'||product.category===category) && (style==='All'||product.type===style) && (price==='All'||(price==='Low'&&product.price<150)||(price==='Medium'&&product.price>=150&&product.price<=250)||(price==='High'&&product.price>250));
  }).sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):0);
  const reset=()=>{setSearch('');setCategory('All');setStyle('All');setPrice('All');setSort('default');};
  return <div className="coffee-site"><StoreHeader /><main className="coffee-menu-page"><div className="coffee-menu-heading"><p className="coffee-eyebrow">A CUP FOR EVERY KIND OF DAY</p><h1>The coffee menu.</h1><p>Pick your brew. Choose your size. Make it your own.</p></div><nav className="coffee-category-tabs" aria-label="Coffee categories">{['All',...categories].map(value=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setCategory(value)}>{value==='All'?'All coffee':value}</button>)}</nav>
    <div className="coffee-menu-filters"><label className="coffee-menu-search"><FiSearch /><input aria-label="Search coffee" placeholder="Search coffee, flavors, or beans" value={search} onChange={event=>setSearch(event.target.value)} /></label><select aria-label="Filter by price" value={price} onChange={event=>setPrice(event.target.value)}><option value="All">Any price</option><option value="Low">Under &#8369;150</option><option value="Medium">&#8369;150 - &#8369;250</option><option value="High">Above &#8369;250</option></select><select aria-label="Filter by coffee style" value={style} onChange={event=>setStyle(event.target.value)}><option value="All">Any coffee style</option>{styles.map(value=><option key={value}>{value}</option>)}</select><select aria-label="Sort coffee" value={sort} onChange={event=>setSort(event.target.value)}><option value="default">Menu order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name: A to Z</option></select></div>
    {!loading && !error && <div className="coffee-results-bar"><p>{results.length} {results.length===1?'coffee':'coffees'} to explore</p><button type="button" onClick={reset}>Clear filters</button></div>}
    {loading ? <p className="coffee-empty-state" role="status">Brewing up the menu...</p> : error ? <div className="coffee-empty-state" role="alert"><h2>The menu is taking a little longer.</h2><p>{error}</p><button className="coffee-button" onClick={()=>setRetry(retry+1)}>Try again</button></div> : !results.length ? <div className="coffee-empty-state"><h2>{products.length?'No cups found.':'The menu is being prepared.'}</h2><p>{products.length?'Try a different search or clear your filters.':'Please check back soon.'}</p><button className="coffee-button" onClick={reset}>Reset filters</button></div> : <div className="coffee-menu-grid">{results.map(product=><CoffeeProductCard key={product._id} product={product}/>)}</div>}
    <aside className="coffee-menu-note"><h2>A coffee that feels like yours.</h2><p>Each product lists its available sizes, preparation choices, and optional extras. Your final selection price is shown before adding it to your bag.</p></aside></main></div>;
}
