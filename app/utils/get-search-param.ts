interface getSearchParamProps {
  request: Request;
  paramName: string;
}

export default function getSearchParam({
  request,
  paramName,
}: getSearchParamProps) {
  return new URL(request.url).searchParams.get(paramName);
}
