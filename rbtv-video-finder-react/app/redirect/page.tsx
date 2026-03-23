"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faExclamationTriangle, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

function RedirectContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";

  useEffect(() => {
    const id = searchParams.get('id');

    if (!id) {
      setError("No video ID provided.");
      return;
    }

    const fetchAndRedirect = async () => {
      try {
        const res = await fetch(`${siteUrl}/api/stream?id=${encodeURIComponent(id)}`);
        const data = await res.json();

        if (data.status === "success" && data.stream) {
          const link = document.createElement('a');
          link.href = data.stream;
          
          link.rel = "noreferrer noopener";
          
          link.click();

          setTimeout(() => {
             window.location.replace(data.stream);
          }, 300);
          
        } else {
          setError(data.message || "Could not find the stream source.");
        }
      } catch (err) {
        setError("Failed to connect to the video service.");
      }
    };

    fetchAndRedirect();
  }, [searchParams, siteUrl]);

  if (error) {
    return (
      <div className="container vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center p-5 shadow-sm rounded bg-white border">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-danger mb-3" size="3x" />
          <h2 className="h4">Redirect Failed</h2>
          <p className="text-muted">{error}</p>
          <Link href="/" className="btn btn-dark mt-3">
            <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container vh-100 d-flex flex-column align-items-center justify-content-center">
      <FontAwesomeIcon icon={faCircleNotch} spin size="3x" className="text-primary mb-4" />
      <h1 className="h5 fw-bold text-dark">Redirecting...</h1>
      <p className="text-muted">Please wait while we resolve the video source.</p>
    </div>
  );
}

export default function RedirectPage() {
  return (
    <Suspense fallback={
      <div className="vh-100 d-flex align-items-center justify-content-center">
        <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
      </div>
    }>
      <RedirectContent />
    </Suspense>
  );
}