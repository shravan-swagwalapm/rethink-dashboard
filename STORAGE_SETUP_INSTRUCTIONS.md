# Storage Bucket Setup Instructions

The file upload feature requires a Supabase storage bucket to be configured. Follow these steps to set it up.

## Quick Setup (5 minutes)

### Step 1: Open Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Setup SQL
1. Click **New Query** button
2. Copy the entire contents of `SETUP_STORAGE.sql` file
3. Paste into the SQL editor
4. Click **Run** button (or press Cmd/Ctrl + Enter)

### Step 3: Verify Setup
After running the SQL, you should see a success message:
```
Storage bucket created successfully!
```

The query will also show bucket details including:
- Bucket ID: `resources`
- File size limit: 52428800 bytes (50MB)
- Number of allowed file types

## What This Does

The SQL script:
1. **Creates a storage bucket** named `resources`
2. **Sets file size limit** to 50MB
3. **Configures allowed file types**:
   - PDF documents
   - Word documents (DOC, DOCX)
   - Excel spreadsheets (XLS, XLSX)
   - Videos (MP4, MOV, AVI, WEBM)
4. **Sets up security policies** to allow authenticated users to:
   - Upload files
   - Read files
   - Delete files
   - Update files

## Troubleshooting

### Error: "relation storage.buckets does not exist"
- Your Supabase project might not have storage enabled
- Contact Supabase support or check your project settings

### Error: "permission denied"
- Make sure you're running the SQL as the project owner
- Check that you have admin access to the database

### Files still not uploading
1. Check browser console for errors (F12 → Console tab)
2. Verify the SQL ran successfully
3. Try logging out and back in
4. Contact support with the error message

## Testing the Upload

After setup:
1. Go to **Resource Management** page
2. Select a cohort
3. Click **Upload Files** button
4. Select a file (under 50MB)
5. File should upload successfully

## Alternative: Manual Setup via UI

If you prefer to use the Supabase UI:

1. Go to **Storage** in Supabase Dashboard
2. Click **Create a new bucket**
3. Enter bucket name: `resources`
4. Set **Public bucket**: `false`
5. Set **File size limit**: `52428800`
6. Click **Save**
7. Go to **Policies** tab
8. Click **New Policy**
9. Create policies for INSERT, SELECT, DELETE, UPDATE (use the SQL above as reference)

---

**Need Help?**
If you encounter any issues, please check the browser console for detailed error messages.
