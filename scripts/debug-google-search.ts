import { GooglePlacesClient } from '../src/places/google-places.client';

async function main() {
  const client = new GooglePlacesClient();

  try {
    const result = await client.searchText('Shibuya Scramble Crossing', 1);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const response =
      error && typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;

    console.log(
      JSON.stringify(
        {
          message: error instanceof Error ? error.message : String(error),
          response,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

void main();
