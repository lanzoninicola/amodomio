


interface GoogleTagManagerNoScriptTagProps {
    id: string | undefined
}

export default function GoogleTagManagerNoScriptTag({ id }: GoogleTagManagerNoScriptTagProps) {

    if (!id) {
        return null
    }

    return (
        <noscript>
            <iframe
                dangerouslySetInnerHTML={{
                    __html: `
src="https://www.googletagmanager.com/ns.html?id=${id}"
height="0" width="0" style="display:none;visibility:hidden"
`}}
            ></iframe>
        </noscript>
    )
}