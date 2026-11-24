import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Box, Container, Flex, Grid, Section } from "./layout";

describe("Layout a11y", () => {
  it("has no violations composing Box, Flex, Grid, Container, and Section", async () => {
    const { container } = render(
      <Section size="md">
        <Container>
          <Flex direction="row" align="center" justify="between" gap="md">
            <Box p="sm">Warehouse fit-out</Box>
            <Box p="sm">$42,000</Box>
          </Flex>
          <Grid columns={3} gap="sm">
            <Box>Quotes</Box>
            <Box>Invoices</Box>
            <Box>Payments</Box>
          </Grid>
        </Container>
      </Section>,
    );
    await expectNoA11yViolations(container);
  });
});
