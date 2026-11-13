import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRunError } from '../src/lib/errorParser.ts'

test('detects SQL Server Error 4060 and extracts database name', () => {
  const sampleLog = `
warn: Microsoft.EntityFrameworkCore.Model.Validation[30000]
fail: Microsoft.EntityFrameworkCore.Database.Connection[20004]
      An error occurred using the connection to database 'THWebBanHang' on server 'DESKTOP-RMJBG58'.
fail: Microsoft.EntityFrameworkCore.Query[10100]
      An exception occurred while iterating over the results of a query for context type 'THWebBanHang.Models.ApplicationDbContext'.
      System.InvalidOperationException: An exception has been raised that is likely due to a transient failure.
       ---> Microsoft.Data.SqlClient.SqlException (0x80131904): Cannot open database "THWebBanHang" requested by the login. The login failed.
      Login failed for user 'DESKTOP-RMJBG58\\VITUS'.
      ClientConnectionId:2093671b-dfc1-472f-b1b9-569ff88ac4b9
      Error Number:4060,State:1,Class:11
`
  const logs = [{ stream: 'stderr', text: sampleLog, time: Date.now() }]
  const result = parseRunError(logs, { status: 'running' })

  assert.ok(result, 'Expected a parsed error')
  assert.equal(result.type, 'database_error')
  assert.equal(result.actionKind, 'ef_database_update')
  assert.ok(result.title.includes('THWebBanHang'))
  assert.ok(result.summary.includes('THWebBanHang'))
  assert.equal(result.actionLabel, 'Tạo Database (dotnet ef database update)')
})

test('detects C# syntax compilation errors', () => {
  const sampleLog = `D:\\Code\\MyApp\\Controllers\\HomeController.cs(24,15): error CS0103: The name 'ViewBag' does not exist in the current context`
  const logs = [{ stream: 'stderr', text: sampleLog, time: Date.now() }]
  const result = parseRunError(logs, { status: 'error', exitCode: 1 })

  assert.ok(result)
  assert.equal(result.type, 'syntax_error')
  assert.equal(result.actionKind, 'open_file')
  assert.equal(result.file, 'HomeController.cs')
  assert.equal(result.line, 24)
})
