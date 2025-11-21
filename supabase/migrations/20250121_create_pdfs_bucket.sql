-- Create PDFs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdfs',
  'pdfs',
  true,
  52428800, -- 50MB in bytes
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for pdfs bucket
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access to PDFs (for Gemini API)
CREATE POLICY "Public can read PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdfs');
