import Link from "next/link";
import type { CustomerDetailResult } from "../../lib/customers.ts";
import { formatDate, getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { DeleteCustomer } from "./delete-customer";
import { OwnedVehicles } from "../vehicles/owned-vehicles";

export function CustomerDetail({ detail, locale }: { detail: CustomerDetailResult; locale: Locale }) {
  const d = getDictionary(locale); const { customer, vehicles } = detail;
  return <div className="customer-detail"><div className="customer-detail-toolbar"><Link className="back-link" href="/customers"><Icon name="back" size={16}/>{d.customers.back}</Link><div className="customer-detail-actions"><DeleteCustomer customer={customer} locale={locale}/><Link className="button primary" href={`/customers/${customer.id}/edit`}><Icon name="edit" size={17}/>{d.customers.edit}</Link></div></div>
    <div className="customer-detail-grid"><div className="customer-detail-main">
      <section className="panel form-section"><div className="customer-contact-heading"><span className="customer-avatar large">{customer.fullName.charAt(0).toLocaleUpperCase(locale)}</span><div><h2>{d.customers.contact}</h2><span className="muted">{customer.fullName}</span></div></div><dl className="customer-contact-list"><div><dt><Icon name="phone" size={17}/>{d.customers.phone}</dt><dd><a href={`tel:${customer.phoneNumber.replace(/[^\d+]/g, "")}`}>{customer.phoneNumber}</a></dd></div><div><dt><Icon name="mail" size={17}/>{d.customers.email}</dt><dd>{customer.email ? <a href={`mailto:${encodeURIComponent(customer.email)}`}>{customer.email}</a> : <span className="muted">{d.customers.unavailable}</span>}</dd></div><div><dt><Icon name="calendar" size={17}/>{d.customers.createdDate}</dt><dd><time dateTime={customer.createdDate}>{formatDate(new Date(customer.createdDate), locale)}</time></dd></div></dl></section>
      <section className="panel form-section"><div className="panel-heading"><h2>{d.customers.notes}</h2><Icon name="clipboard" size={19}/></div><p className={customer.notes ? "customer-notes" : "customer-notes muted"}>{customer.notes || d.customers.noNotes}</p></section>
      <OwnedVehicles customerId={customer.id} vehicles={vehicles} locale={locale}/>
    </div><aside className="customer-detail-aside"><section className="panel form-section customer-spending"><Icon name="chart" size={24}/><h2>{d.customers.totalSpending}</h2><strong aria-hidden="true">—</strong><span className="step-badge">{d.customers.pending}</span><p>{d.customers.spendingPending}</p></section><section className="panel form-section"><div className="panel-heading"><h2>{d.customers.jobs}</h2><Icon name="clipboard" size={19}/></div><p className="customer-pending-text">{d.customers.jobsPending}</p></section></aside></div>
  </div>;
}
