// @ts-nocheck
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

ModuleRegistry.registerModules([AllCommunityModule])

interface Props {
  rows: any[]
  cols: any[]
  height?: number
  autoHeight?: boolean
  pagination?: boolean
  pageSize?: number
  onRowClick?: (row: any) => void
  onSelectionChanged?: (selectedRows: any[]) => void
  multiSelect?: boolean
  checkboxCol?: boolean
}

export function DataTable({ rows, cols, height = 480, autoHeight = false, pagination = false, pageSize = 20, onRowClick, onSelectionChanged, multiSelect = false, checkboxCol = false }: Props) {
  const checkboxColDef = checkboxCol ? [{
    headerCheckboxSelection: true,
    checkboxSelection: true,
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    sortable: false,
    filter: false,
    pinned: 'left',
    suppressMovable: true,
  }] : []

  return (
    <div
      className="ag-theme-alpine overflow-hidden"
      style={{
        height: autoHeight ? 'auto' : height,
        width: '100%',
        borderRadius: '0.75rem',
        border: '1px solid #e1e2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <AgGridReact
        rowData={rows}
        columnDefs={[...checkboxColDef, ...cols]}
        domLayout={autoHeight ? 'autoHeight' : 'normal'}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
          minWidth: 80,
        }}
        rowSelection={multiSelect || checkboxCol ? 'multiple' : 'single'}
        rowMultiSelectWithClick={multiSelect && !checkboxCol}
        suppressRowClickSelection={checkboxCol ? true : (multiSelect ? false : true)}
        onRowClicked={e => {
          onRowClick?.(e.data)
        }}
        onSelectionChanged={e => {
          if (onSelectionChanged) {
            onSelectionChanged(e.api.getSelectedRows())
          }
        }}
        pagination={pagination}
        paginationPageSize={pageSize}
        paginationPageSizeSelector={pagination ? [10, 20, 50] : undefined}
        suppressCellFocus
        animateRows={false}
        theme="legacy"
      />
    </div>
  )
}
