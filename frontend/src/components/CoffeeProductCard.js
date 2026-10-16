import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';
import { money } from '../storeState';
export default function CoffeeProductCard({ product }) {
  const available = product.stock > 0 && product.status !== 'out_of_stock';
  return <article className="coffee-menu-card"><Link className="coffee-menu-image" to={`/products/${product._id}`} aria-label={`View ${product.name}`}><img src={product.image || product.img} alt={product.name} loading="lazy" />{!available && <span>Sold out</span>}</Link><div className="coffee-menu-card-copy"><p className="coffee-eyebrow">{product.type || product.category}</p><h3><Link to={`/products/${product._id}`}>{product.name}</Link></h3><p className="coffee-card-description">{product.description}</p><div><strong>{product.optionGroups?.some(group=>group.choices.some(choice=>choice.priceAdjustment>0)) ? 'From ' : ''}{money(product.price)}</strong><Link to={`/products/${product._id}`} className="coffee-card-order">{available ? 'Choose options' : 'View details'} <FiArrowUpRight /></Link></div></div></article>;
}
