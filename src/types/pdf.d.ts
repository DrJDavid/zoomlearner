declare module 'pdfjs-dist' {
    export interface DocumentInitParameters {
        data: ArrayBuffer | URL | TypedArray;
        useSystemFonts?: boolean;
    }

    export interface GetTextContentParameters {
        normalizeWhitespace?: boolean;
        disableCombineTextItems?: boolean;
        includeMarkedContent?: boolean;
    }

    export interface TextContent {
        items: Array<{
            str: string;
            [key: string]: any;
        }>;
    }

    export interface PDFPageProxy {
        getTextContent(): Promise<TextContent>;
    }

    export interface PDFDocumentProxy {
        numPages: number;
        getPage(pageNumber: number): Promise<PDFPageProxy>;
    }

    export function getDocument(params: DocumentInitParameters | ArrayBuffer): {
        promise: Promise<PDFDocumentProxy>;
    };

    export const GlobalWorkerOptions: {
        workerSrc: string;
    };
} 