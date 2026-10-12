export const AdminPagination = ({ page, totalPages, total, onPage, busy = false }) => <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
  <span className="small text-secondary">{total} resultados · Página {page} de {Math.max(1, totalPages)}</span>
  <div className="d-flex gap-2"><button className="btn btn-outline-secondary" type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
    <button className="btn btn-outline-secondary" type="button" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)}>Siguiente</button></div>
</div>
