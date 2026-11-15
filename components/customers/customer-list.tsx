"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { customerListPath } from "../../lib/customers.ts";
import type { CustomerListResult, CustomerSort } from "../../lib/customers.ts";
import { formatDate, getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { DeleteCustomer } from "./delete-customer";

export function CustomerList({ result, locale }: { result: CustomerListResult; locale: Locale }) {
  const d = getDictionary(locale); const router = useRouter();
  const [search, setSearch] = useState(result.query); const [pending, startTransition] = useTransition();
  useEffect(() => setSearch(result.query), [result.query]);
  function navigate(query: string, sort: CustomerSort, page = 1) { startTransition(() => router.push(customerListPath({ query, sort, page, pageSize: result.pageSize }))); }
  return <div className="customer-list" aria-busy={pending}>
    <div className="customer-toolbar"><div className="customer-count"><span className="customer-count-icon"><Icon name="users"/></span><strong>{new Intl.NumberFormat(locale).format(result.total)}</strong><span>{d.customers.countLabel}</span></div><Link href="/customers/new" className="button primary"><Icon name="plus" size={17}/>{d.customers.add}</Link></div>
    <section className="panel customer-list-panel">
      <div className="customer-list-controls"><form onSubmit={event => { event.preventDefault(); navigate(search, result.sort); }} className="customer-search" role="search"><label className="sr-only" htmlFor="customer-search">{d.customers.searchLabel}</label><div className="customer-search-input"><Icon name="search" size={18}/><input id="customer-search" type="search" maxLength={200} value={search} placeholder={d.customers.searchHint} onChange={event => setSearch(event.target.value)}/></div><button className="button secondary" disabled={pending} type="submit">{d.customers.search}</button></form><div className="customer-sort"><label className="sr-only" htmlFor="customer-sort">{d.customers.sort}</label><select id="customer-sort" value={result.sort} disabled={pending} onChange={event => navigate(search, event.target.value as CustomerSort)}><option value="name_asc">{d.customers.nameAscending}</option><option value="name_desc">{d.customers.nameDescending}</option><option value="created_desc">{d.customers.newest}</option></select></div></div>
      <div role="status" className="sr-only">{pending ? d.customers.loading : `${result.total} ${d.customers.countLabel}`}</div>
      {result.items.length === 0 ? <div className="customers-empty"><span className="module-icon"><Icon name={result.query ? "search" : "users"} size={30}/></span><h2>{result.query ? d.customers.noResultsTitle : d.customers.emptyTitle}</h2><p>{result.query ? d.customers.noResultsBody : d.customers.emptyBody}</p>{result.query ? <Link href="/customers" className="button secondary">{d.customers.clearSearch}</Link> : <Link href="/customers/new" className="button primary">{d.customers.add}<Icon name="plus" size={17}/></Link>}</div> : <>
        <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th scope="col">{d.customers.name}</th><th scope="col">{d.customers.phone}</th><th scope="col">{d.customers.email}</th><th scope="col">{d.customers.createdDate}</th><th scope="col"><span className="sr-only">{d.customers.actions}</span></th></tr></thead><tbody>{result.items.map(customer => <tr key={customer.id}>
          <td className="customer-name-cell"><Link href={`/customers/${customer.id}`} className="customer-name-link"><span className="customer-avatar">{customer.fullName.charAt(0).toLocaleUpperCase(locale)}</span><strong>{customer.fullName}</strong><Icon name="chevron" size={15}/></Link></td>
          <td data-label={d.customers.phone}><a className="contact-link" href={`tel:${customer.phoneNumber.replace(/[^\d+]/g, "")}`}>{customer.phoneNumber}</a></td>
          <td data-label={d.customers.email}>{customer.email ? <a className="contact-link" href={`mailto:${encodeURIComponent(customer.email)}`}>{customer.email}</a> : <span className="muted">{d.customers.unavailable}</span>}</td>
          <td data-label={d.customers.createdDate} className="customer-date-cell"><time dateTime={customer.createdDate}>{formatDate(new Date(customer.createdDate), locale)}</time></td>
          <td className="customer-row-actions"><Link href={`/customers/${customer.id}`} className="icon-button" title={d.customers.view} aria-label={`${d.customers.view}: ${customer.fullName}`}><Icon name="arrow" size={17}/></Link><Link href={`/customers/${customer.id}/edit`} className="icon-button" title={d.customers.edit} aria-label={`${d.customers.edit}: ${customer.fullName}`}><Icon name="edit" size={17}/></Link><DeleteCustomer customer={customer} locale={locale} compact/></td>
        </tr>)}</tbody></table></div>
        <nav className="customer-pagination" aria-label={d.customers.pagination}><span>{d.customers.page} <strong>{result.page}</strong> / {result.totalPages}</span><div><button className="button secondary" disabled={pending || result.page <= 1} onClick={() => navigate(result.query, result.sort, result.page - 1)}><Icon name="back" size={15}/>{d.customers.previous}</button><button className="button secondary" disabled={pending || result.page >= result.totalPages} onClick={() => navigate(result.query, result.sort, result.page + 1)}>{d.customers.next}<Icon name="arrow" size={15}/></button></div></nav>
      </>}
    </section>
  </div>;
}
