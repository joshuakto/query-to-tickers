import DatabaseViewer from '@/components/database-viewer'

export default function DatabasePage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Stock Database Explorer</h1>
      <p className="mb-6 text-gray-600">
        Use this tool to explore the stock database and verify exchange information. 
        This can help debug prioritization issues with different exchanges.
      </p>
      <DatabaseViewer />
    </div>
  )
} 